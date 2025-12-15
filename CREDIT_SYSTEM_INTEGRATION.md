# 积分和支付系统集成方案

## 📋 概述

本文档分析如何将 [credit-based-backend-gpt-pilot-example](https://github.com/Pythagora-io/credit-based-backend-gpt-pilot-example) 项目的积分和支付系统集成到 Forsion AI Studio 项目中。

## ✅ 可行性分析

### 当前项目架构
- **后端框架**: Express.js + TypeScript
- **数据库**: MySQL 8.0
- **认证系统**: JWT
- **用户管理**: 完整的用户系统（users表）
- **使用统计**: 已有 api_usage_logs 表记录API调用

### 参考项目架构
- **后端框架**: Express.js + JavaScript
- **数据库**: MongoDB + Mongoose
- **认证系统**: JWT + Passport
- **支付系统**: Stripe
- **积分系统**: 基于积分的计费

### 集成可行性：✅ **高度可行**

**优势**：
1. ✅ 两个项目都使用 Express.js，架构相似
2. ✅ 都有JWT认证系统，可以复用
3. ✅ 当前项目已有用户系统和使用日志，只需扩展
4. ✅ MySQL可以很好地支持积分和交易记录

**需要适配的部分**：
1. 🔄 将MongoDB的Mongoose模型转换为MySQL表结构
2. 🔄 将JavaScript代码转换为TypeScript
3. 🔄 集成Stripe支付SDK
4. 🔄 修改API调用逻辑，添加积分检查

## 🗄️ 数据库设计

需要添加以下表：

### 1. 用户积分表 (user_credits)
```sql
CREATE TABLE IF NOT EXISTS user_credits (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) UNIQUE NOT NULL,
  balance DECIMAL(10, 2) DEFAULT 0.00,
  total_earned DECIMAL(10, 2) DEFAULT 0.00,
  total_spent DECIMAL(10, 2) DEFAULT 0.00,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2. 积分交易记录表 (credit_transactions)
```sql
CREATE TABLE IF NOT EXISTS credit_transactions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type ENUM('purchase', 'usage', 'refund', 'bonus', 'adjustment') NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  balance_before DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  description TEXT,
  reference_id VARCHAR(255), -- 关联订单ID或使用记录ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3. 订单表 (orders)
```sql
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  stripe_session_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  package_id VARCHAR(50) NOT NULL, -- 套餐ID
  package_name VARCHAR(200) NOT NULL,
  credits_amount DECIMAL(10, 2) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
  paid_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_stripe_session_id (stripe_session_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 4. 发票表 (invoices)
```sql
CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  order_id VARCHAR(36) NOT NULL,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  status ENUM('draft', 'paid', 'overdue', 'cancelled') DEFAULT 'draft',
  pdf_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_invoice_number (invoice_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 🔧 需要实现的功能模块

### 1. 积分服务 (creditService.ts)
```typescript
// 主要功能：
- getCreditBalance(userId: string): Promise<number>
- addCredits(userId: string, amount: number, type: string, description?: string): Promise<void>
- deductCredits(userId: string, amount: number, description?: string): Promise<boolean>
- getTransactionHistory(userId: string, limit?: number): Promise<Transaction[]>
- checkSufficientCredits(userId: string, amount: number): Promise<boolean>
```

### 2. 支付服务 (paymentService.ts)
```typescript
// 主要功能：
- createCheckoutSession(userId: string, packageId: string): Promise<Stripe.Checkout.Session>
- handleWebhook(payload: string, signature: string): Promise<void>
- getOrderById(orderId: string): Promise<Order>
- generateInvoice(orderId: string): Promise<Invoice>
```

### 3. 积分套餐配置
```typescript
// 在 config.ts 或单独文件定义
export const CREDIT_PACKAGES = [
  { id: 'starter', name: 'Starter', credits: 1000, price: 9.99, currency: 'USD' },
  { id: 'professional', name: 'Professional', credits: 5000, price: 39.99, currency: 'USD' },
  { id: 'enterprise', name: 'Enterprise', credits: 15000, price: 99.99, currency: 'USD' },
];
```

### 4. API调用计费逻辑
在 `chat.ts` 路由中添加积分检查：
```typescript
// 在调用AI API之前
const estimatedCost = calculateCost(model_id, tokens_input, tokens_output);
const hasCredits = await checkSufficientCredits(userId, estimatedCost);
if (!hasCredits) {
  return res.status(402).json({ detail: 'Insufficient credits' });
}

// API调用成功后
await deductCredits(userId, actualCost, `API usage: ${model_id}`);
```

## 📦 需要安装的依赖

```json
{
  "dependencies": {
    "stripe": "^14.0.0",
    "@stripe/stripe-js": "^2.0.0"
  },
  "devDependencies": {
    "@types/stripe": "^8.0.0"
  }
}
```

## 🛣️ 需要添加的API路由

### 积分相关 (`/api/credits`)
- `GET /api/credits/balance` - 获取当前积分余额
- `GET /api/credits/transactions` - 获取交易历史
- `GET /api/credits/packages` - 获取可用套餐列表

### 支付相关 (`/api/payment`)
- `POST /api/payment/create-checkout` - 创建支付会话
- `POST /api/payment/webhook` - Stripe webhook处理
- `GET /api/payment/orders` - 获取订单列表
- `GET /api/payment/invoices/:id` - 获取发票详情
- `GET /api/payment/invoices/:id/download` - 下载发票PDF

## 🔄 集成步骤

### 阶段1: 数据库扩展
1. ✅ 创建数据库迁移脚本，添加积分相关表
2. ✅ 更新用户创建逻辑，自动创建积分账户

### 阶段2: 积分服务
1. ✅ 实现 creditService.ts
2. ✅ 添加积分检查和扣除逻辑
3. ✅ 实现交易历史查询

### 阶段3: 支付集成
1. ✅ 配置Stripe账户和API密钥
2. ✅ 实现 paymentService.ts
3. ✅ 添加支付路由和webhook处理

### 阶段4: API计费
1. ✅ 实现成本计算函数
2. ✅ 在chat路由中添加积分检查
3. ✅ 在API调用后扣除积分

### 阶段5: 前端集成
1. ✅ 添加积分余额显示
2. ✅ 添加购买积分页面
3. ✅ 添加订单和发票查看页面

## ⚠️ 注意事项

1. **成本计算**: 需要根据不同的AI模型和token使用量计算成本
2. **并发安全**: 积分扣除需要使用数据库事务，防止并发问题
3. **Webhook安全**: Stripe webhook需要验证签名
4. **错误处理**: 支付失败、积分不足等情况需要友好提示
5. **测试环境**: 使用Stripe测试模式进行开发测试

## 📚 参考资源

- [Stripe官方文档](https://stripe.com/docs)
- [Stripe Node.js SDK](https://github.com/stripe/stripe-node)
- [参考项目仓库](https://github.com/Pythagora-io/credit-based-backend-gpt-pilot-example)

## 🎯 总结

该积分和支付系统**完全可以集成**到当前项目中。主要工作包括：
1. 数据库表扩展（4个新表）
2. 积分服务实现（约200-300行代码）
3. Stripe支付集成（约300-400行代码）
4. API调用逻辑修改（约50-100行代码）
5. 前端UI添加（可选，根据需求）

预计开发时间：**2-3天**（包括测试）

