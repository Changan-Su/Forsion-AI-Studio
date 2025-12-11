from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .storage import (
	create_global_model,
	create_user,
	delete_global_model,
	delete_user as storage_delete_user,
	ensure_admin_exists,
	get_api_usage_stats,
	get_default_model_id,
	get_developer_mode,
	get_global_model,
	get_settings as storage_get_settings,
	get_user as storage_get_user,
	list_global_models,
	list_users as storage_list_users,
	log_api_usage,
	set_default_model_id,
	set_developer_mode,
	update_global_model,
	update_password as storage_update_password,
	update_settings as storage_update_settings,
	verify_user,
)


app = FastAPI(title="Forsion AI Studio API")

# Serve admin panel static files
ADMIN_DIR = Path(__file__).parent.parent / "admin"
if ADMIN_DIR.exists():
	app.mount("/admin", StaticFiles(directory=str(ADMIN_DIR), html=True), name="admin")


@app.on_event("startup")
def startup_event():
	"""Initialize database and ensure admin user exists on startup."""
	ensure_admin_exists()

ALLOWED_ORIGINS = [
	"http://localhost:3000",
	"http://localhost:50173",
	"http://localhost:5173",
	"http://localhost:8080",
	"https://localhost:5173",
	"http://127.0.0.1:50173",
	"http://127.0.0.1:5173",
	"http://127.0.0.1:8080",
	"https://127.0.0.1:5173",
	"http://winemountain.art",
	"http://winemountain.art:5173",
	"http://winemountain.art:4173",
	"https://winemountain.art",
	"https://winemountain.art:5173",
]


def _origin_allowed(origin: Optional[str]) -> bool:
	if not origin:
		return False
	return any(origin == allowed for allowed in ALLOWED_ORIGINS)

@app.middleware("http")
async def ensure_preflight(request: Request, call_next):
	if request.method == "OPTIONS" and request.url.path.startswith("/api/"):
		response = Response(status_code=200)
	else:
		response = await call_next(request)

	origin = request.headers.get("origin")
	if _origin_allowed(origin):
		response.headers["Access-Control-Allow-Origin"] = origin  # echo actual origin
		response.headers["Access-Control-Allow-Credentials"] = "true"
		response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS"
		requested_headers = request.headers.get("access-control-request-headers") or "*"
		response.headers["Access-Control-Allow-Headers"] = requested_headers
		response.headers["Vary"] = "Origin"
	return response


@app.options("/api/{full_path:path}")
def handle_preflight(full_path: str) -> Response:
	"""Ensure OPTIONS requests succeed even before auth headers exist."""
	return Response(status_code=200)


class AuthPayload(BaseModel):
	username: str
	password: str


class PasswordPayload(BaseModel):
	new_password: str


class SettingsPayload(BaseModel):
	theme: Optional[str] = None
	themePreset: Optional[str] = None
	customModels: Optional[List[Dict]] = None
	externalApiConfigs: Optional[Dict[str, Dict[str, str]]] = None
	defaultModelId: Optional[str] = None
	developerMode: Optional[bool] = None


class AdminUserPayload(BaseModel):
	username: str
	password: str
	role: Optional[str] = "USER"


def _sanitize_user(user: Dict) -> Dict:
	return {k: v for k, v in user.items() if k != "password"}


def _resolve_user_from_token(authorization: Optional[str]) -> Optional[Dict]:
	username: Optional[str] = None
	if authorization and authorization.startswith("Bearer "):
		token = authorization.split(" ", 1)[1]
		if token.startswith("mock-token-"):
			username = token.replace("mock-token-", "", 1)
	if not username:
		username = "admin"

	user = storage_get_user(username)
	if user:
		return user
	if username == "admin":
		return create_user("admin", "admin", role="ADMIN")
	return None


def get_current_user(authorization: Optional[str] = Header(default=None)) -> Dict:
	user = _resolve_user_from_token(authorization)
	if not user:
		raise HTTPException(status_code=401, detail="Unauthorized")
	return user


def require_admin(user: Dict = Depends(get_current_user)) -> Dict:
	if user.get("role") != "ADMIN":
		raise HTTPException(status_code=403, detail="Admin access required")
	return user


@app.get("/")
def health_check():
	return {"status": "ok", "message": "Forsion AI Studio backend ready"}


@app.post("/api/auth/login")
def login(payload: AuthPayload):
	user = verify_user(payload.username, payload.password)
	if not user:
		raise HTTPException(status_code=401, detail="Invalid credentials")
	return {"token": f"mock-token-{user['username']}", "user": _sanitize_user(user)}


@app.post("/api/auth/password")
def change_password(payload: PasswordPayload, user: Dict = Depends(get_current_user)):
	storage_update_password(user["username"], payload.new_password)
	return {"success": True}


@app.get("/api/settings")
def get_settings(user: Dict = Depends(get_current_user)):
	settings = storage_get_settings(user["username"])
	settings["defaultModelId"] = get_default_model_id()
	settings["developerMode"] = get_developer_mode(user["username"])
	return settings


@app.put("/api/settings")
def update_settings(payload: SettingsPayload, user: Dict = Depends(get_current_user)):
	update_data = payload.dict(exclude_unset=True)
	default_model = update_data.pop("defaultModelId", None)
	developer_mode = update_data.pop("developerMode", None)
	
	updated = storage_update_settings(user["username"], update_data)
	
	if default_model is not None:
		if user.get("role") != "ADMIN":
			raise HTTPException(status_code=403, detail="Admin access required")
		set_default_model_id(default_model)
	
	if developer_mode is not None:
		set_developer_mode(user["username"], developer_mode)
	
	updated["defaultModelId"] = get_default_model_id()
	updated["developerMode"] = get_developer_mode(user["username"])
	return updated


@app.get("/api/admin/users")
def list_users(_: Dict = Depends(require_admin)):
	return [_sanitize_user(u) for u in storage_list_users()]


@app.post("/api/admin/users")
def admin_create_user(payload: AdminUserPayload, _: Dict = Depends(require_admin)):
	try:
		user = create_user(payload.username, payload.password, role=payload.role or "USER")
	except ValueError:
		raise HTTPException(status_code=400, detail="Username exists")
	return _sanitize_user(user)


@app.delete("/api/admin/users/{username}")
def admin_delete_user(username: str, _: Dict = Depends(require_admin)):
	if username == "admin":
		raise HTTPException(status_code=400, detail="Cannot delete default admin")
	storage_delete_user(username)
	return {"success": True}


# ============ API Usage Stats (Admin) ============

@app.get("/api/admin/usage")
def get_usage_stats(
	username: Optional[str] = None,
	model_id: Optional[str] = None,
	days: int = 30,
	_: Dict = Depends(require_admin)
):
	"""Get API usage statistics."""
	return get_api_usage_stats(username=username, model_id=model_id, days=days)


@app.post("/api/usage/log")
def log_usage(
	model_id: str,
	model_name: Optional[str] = None,
	provider: Optional[str] = None,
	tokens_input: int = 0,
	tokens_output: int = 0,
	success: bool = True,
	error_message: Optional[str] = None,
	user: Dict = Depends(get_current_user)
):
	"""Log an API usage record."""
	return log_api_usage(
		username=user["username"],
		model_id=model_id,
		model_name=model_name,
		provider=provider,
		tokens_input=tokens_input,
		tokens_output=tokens_output,
		success=success,
		error_message=error_message
	)


# ============ Global Models Management (Admin) ============

class GlobalModelPayload(BaseModel):
	id: str
	name: str
	provider: str
	description: Optional[str] = None
	icon: Optional[str] = "Box"
	apiModelId: Optional[str] = None
	configKey: Optional[str] = None
	defaultBaseUrl: Optional[str] = None
	apiKey: Optional[str] = None
	isEnabled: Optional[bool] = True


@app.get("/api/admin/models")
def list_admin_models(_: Dict = Depends(require_admin)):
	"""List all global models with API keys (admin only)."""
	return list_global_models(include_disabled=True, include_api_keys=True)


@app.get("/api/models")
def list_public_models():
	"""List all enabled global models (public, no API keys)."""
	return list_global_models(include_disabled=False, include_api_keys=False)


@app.post("/api/admin/models")
def create_admin_model(payload: GlobalModelPayload, _: Dict = Depends(require_admin)):
	"""Create a new global model."""
	try:
		return create_global_model(
			model_id=payload.id,
			name=payload.name,
			provider=payload.provider,
			description=payload.description,
			icon=payload.icon,
			api_model_id=payload.apiModelId,
			config_key=payload.configKey,
			default_base_url=payload.defaultBaseUrl,
			api_key=payload.apiKey
		)
	except ValueError as e:
		raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/admin/models/{model_id}")
def update_admin_model(model_id: str, payload: Dict, _: Dict = Depends(require_admin)):
	"""Update a global model."""
	try:
		return update_global_model(model_id, payload)
	except ValueError as e:
		raise HTTPException(status_code=404, detail=str(e))


@app.delete("/api/admin/models/{model_id}")
def delete_admin_model(model_id: str, _: Dict = Depends(require_admin)):
	"""Delete a global model."""
	delete_global_model(model_id)
	return {"success": True}


@app.get("/api/admin/models/{model_id}")
def get_admin_model(model_id: str, _: Dict = Depends(require_admin)):
	"""Get a specific global model with API key."""
	model = get_global_model(model_id)
	if not model:
		raise HTTPException(status_code=404, detail="Model not found")
	return model


# ============ File Parsing API ============

from fastapi import File, UploadFile
import base64
import io


def extract_pdf_text(file_content: bytes) -> str:
	"""Extract text from a PDF file."""
	try:
		from PyPDF2 import PdfReader
		reader = PdfReader(io.BytesIO(file_content))
		text = ""
		for page in reader.pages:
			text += page.extract_text() or ""
		return text.strip()
	except Exception as e:
		return f"[Error extracting PDF text: {str(e)}]"


def extract_docx_text(file_content: bytes) -> str:
	"""Extract text from a Word document."""
	try:
		from docx import Document
		doc = Document(io.BytesIO(file_content))
		text = "\n".join([para.text for para in doc.paragraphs])
		return text.strip()
	except Exception as e:
		return f"[Error extracting Word text: {str(e)}]"


@app.post("/api/parse-file")
async def parse_file(file: UploadFile = File(...)):
	"""Parse uploaded file and extract text content."""
	content = await file.read()
	filename = file.filename or "unknown"
	content_type = file.content_type or ""
	
	extracted_text = ""
	
	if content_type == "application/pdf" or filename.lower().endswith(".pdf"):
		extracted_text = extract_pdf_text(content)
	elif content_type in [
		"application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	] or filename.lower().endswith((".doc", ".docx")):
		extracted_text = extract_docx_text(content)
	elif content_type.startswith("text/") or filename.lower().endswith((".txt", ".md")):
		extracted_text = content.decode("utf-8", errors="replace")
	else:
		# Return base64 for unsupported types (images, etc.)
		return {
			"filename": filename,
			"content_type": content_type,
			"text": None,
			"base64": base64.b64encode(content).decode("utf-8")
		}
	
	return {
		"filename": filename,
		"content_type": content_type,
		"text": extracted_text,
		"base64": None
	}


@app.post("/api/parse-base64")
async def parse_base64(request: Request):
	"""Parse base64 encoded file content."""
	body = await request.json()
	base64_data = body.get("data", "")
	filename = body.get("filename", "unknown")
	content_type = body.get("content_type", "")
	
	# Remove data URL prefix if present
	if "," in base64_data:
		base64_data = base64_data.split(",")[1]
	
	try:
		content = base64.b64decode(base64_data)
	except Exception as e:
		raise HTTPException(status_code=400, detail=f"Invalid base64 data: {str(e)}")
	
	extracted_text = ""
	
	if "pdf" in content_type.lower() or filename.lower().endswith(".pdf"):
		extracted_text = extract_pdf_text(content)
	elif "word" in content_type.lower() or "msword" in content_type.lower() or filename.lower().endswith((".doc", ".docx")):
		extracted_text = extract_docx_text(content)
	elif "text" in content_type.lower() or filename.lower().endswith((".txt", ".md")):
		extracted_text = content.decode("utf-8", errors="replace")
	else:
		return {"text": None, "error": "Unsupported file type for text extraction"}
	
	return {"text": extracted_text, "filename": filename}


# ============ AI Proxy API ============
import httpx
from typing import Any


class ChatCompletionRequest(BaseModel):
	"""Request body for chat completions proxy."""
	model_id: str  # Global model ID
	messages: List[Dict[str, Any]]
	temperature: Optional[float] = 0.7
	max_tokens: Optional[int] = None
	stream: Optional[bool] = False


@app.post("/api/chat/completions")
async def proxy_chat_completions(
	request: ChatCompletionRequest,
	user: Dict = Depends(get_current_user)
):
	"""
	Proxy chat completion requests to external AI APIs.
	Uses API keys stored in global model configuration.
	"""
	# Get the global model configuration
	model = get_global_model(request.model_id)
	if not model:
		raise HTTPException(status_code=404, detail=f"Model '{request.model_id}' not found")
	
	if not model.get("isEnabled", True):
		raise HTTPException(status_code=400, detail=f"Model '{request.model_id}' is disabled")
	
	api_key = model.get("apiKey")
	if not api_key:
		raise HTTPException(status_code=400, detail=f"API Key not configured for model '{model.get('name', request.model_id)}'")
	
	base_url = model.get("defaultBaseUrl", "https://api.openai.com/v1")
	api_model_id = model.get("apiModelId") or request.model_id
	
	# Ensure base_url doesn't end with /
	base_url = base_url.rstrip("/")
	
	# Build the request to the external API
	external_url = f"{base_url}/chat/completions"
	headers = {
		"Authorization": f"Bearer {api_key}",
		"Content-Type": "application/json"
	}
	
	payload = {
		"model": api_model_id,
		"messages": request.messages,
		"temperature": request.temperature,
	}
	if request.max_tokens:
		payload["max_tokens"] = request.max_tokens
	
	try:
		async with httpx.AsyncClient(timeout=120.0) as client:
			response = await client.post(external_url, json=payload, headers=headers)
			
			if response.status_code != 200:
				error_detail = response.text
				try:
					error_json = response.json()
					error_detail = error_json.get("error", {}).get("message", response.text)
				except:
					pass
				raise HTTPException(status_code=response.status_code, detail=error_detail)
			
			result = response.json()
			
			# Log API usage
			try:
				usage = result.get("usage", {})
				log_api_usage(
					username=user.get("username", "unknown"),
					model_id=request.model_id,
					model_name=model.get("name", request.model_id),
					provider=model.get("provider", "external"),
					tokens_input=usage.get("prompt_tokens", 0),
					tokens_output=usage.get("completion_tokens", 0),
					success=True
				)
			except Exception as e:
				print(f"Failed to log API usage: {e}")
			
			return result
			
	except httpx.TimeoutException:
		raise HTTPException(status_code=504, detail="Request to AI API timed out")
	except httpx.RequestError as e:
		raise HTTPException(status_code=502, detail=f"Failed to connect to AI API: {str(e)}")