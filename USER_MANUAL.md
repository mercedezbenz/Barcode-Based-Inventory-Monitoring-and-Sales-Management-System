# 📘 USER MANUAL – SUPPLY CHAIN MANAGEMENT SYSTEM

---

## 🎯 PURPOSE

This manual explains how to use the system for the following roles:

* 🧑💼 Owner (Admin)
* 🧾 Sales
* 🧑🔧 Encoder

Each role has different access and responsibilities.

---

# 🔐 ACCOUNT ACCESS (ALL USERS)

## ✅ How to Log In

1. Go to the system URL
2. Enter:

   * Email
   * Password
3. Click **Login**

---

## 👤 Account Menu (Top Right)

Click your profile icon to access:

* **Role Display**
  → Shows if you are Owner / Sales / Encoder
* **Appearance Toggle**
  → Switch between Light / Dark mode
* **Logout**
  → Securely exit the system

---

## 🔐 Sample Accounts

Below are the sample accounts used in the system:

### 🧑💼 Owner Account
- Email: owner@decktago.com
- Password: (provided by system administrator)

---

### 🧾 Sales Account
- Email: sales@decktago.com
- Password: (provided by system administrator)

---

### 🧑🔧 Encoder Account
- Email: encoder@decktago.com
- Password: (provided by system administrator)

---

> 🔒 Note: Passwords are managed securely and are not included in this manual.

---

# 🧑💼 OWNER DASHBOARD GUIDE

## 🎯 Purpose:

Monitor overall inventory and system status.

---

## 📊 Main Dashboard Features

### 1. TOTAL ITEMS

* Shows total number of unique products
* Displays total kg and total boxes

---

### 2. LOW STOCK

* Shows products with ≤ 50 kg remaining
* Helps identify items that need restocking

---

### 3. OUT OF STOCK

* Shows items with 0 kg remaining

---

### 4. SALES SUMMARY (Owner Only)

* Sales Today (kg)
* Sales This Week (kg)
* Top Selling Products

---

### 5. STOCK STATUS OVERVIEW

* Visual distribution:

  * In Stock
  * Low Stock
  * Out of Stock

---

### 6. INVENTORY INSIGHTS

* Smart alerts:

  * Out of stock items
  * Low stock warnings

---

### 7. STOCK ALERT & UPDATES

* Real-time list of critical items
* Shows:

  * Product name
  * Stock status
  * Last update

---

## ✅ What Owner Does

* Monitor stock levels
* Check low stock alerts
* Review sales activity (kg-based)
* Make decisions for restocking

---

# 🧾 SALES DASHBOARD GUIDE

## 🎯 Purpose:

Handle customer orders and monitor outgoing products.

---

## 📊 Dashboard Features

### 1. ORDERS TODAY

* Number of orders received today

---

### 2. PENDING ORDERS

* Orders waiting for processing

---

### 3. COMPLETED ORDERS

* Successfully fulfilled orders

---

### 4. KG SOLD TODAY

* Total kg of completed orders today

---

### 5. SALES THIS WEEK

* Weekly outgoing kg

---

### 6. TOP PRODUCTS

* Most sold products based on kg

---

### 7. LOW STOCK WARNING

* Shows items near 50kg threshold

---

## 🧾 ORDER PROCESS

### Step 1: Create Order

* Input customer details
* Select products (kg-based)

---

### Step 2: Submit Order

* Order goes to **Encoder Tasks**

---

## ✅ What Sales Does

* Create customer orders
* Monitor order status
* Track outgoing inventory (kg)

---

# 🧑🔧 ENCODER DASHBOARD GUIDE

## 🎯 Purpose:

Process and verify stock deductions using barcode scanning.

---

## 📦 Encoder Tasks Tabs

### 1. PENDING

* Newly created orders from Sales

---

### 2. VERIFICATION

* Scan product barcodes
* Confirm correct stock allocation

---

### 3. FOR DELIVERY

* Ready for dispatch

---

### 4. ON DELIVERY

* Currently being delivered

---

### 5. COMPLETED

* Finished transactions

---

## 🔍 SCANNING PROCESS (IMPORTANT)

1. Open a task in **Verification**
2. Scan barcode of product
3. System will:

   * Deduct stock (kg)
   * Apply FIFO (oldest first)

---

## 🔄 SYSTEM BEHAVIOR

After scanning:

✔ Inventory table updates automatically
✔ Remaining weight decreases
✔ If 0 kg → marked **OUT OF STOCK**
✔ Item moves to bottom of its batch group
✔ Transaction is recorded

---

## 📜 TRANSACTION HISTORY

Each scan creates:

* OUT (usage)
* IN (restock)
* RETURN (if applicable)

---

## ✅ What Encoder Does

* Scan products
* Deduct stock accurately
* Verify order fulfillment
* Ensure FIFO is followed

---

# ⚠️ IMPORTANT RULES (SYSTEM LOGIC)

### 📦 Weight-Based System

* All calculations are in **kg**
* 1 BOX = 25 kg (display only)

---

### 🚨 Low Stock Rule

* Trigger when:

```text
≤ 50 kg remaining
```

---

### 🔁 FIFO SYSTEM

* Oldest stock is used first
* Expiring items prioritized

---

### 🔔 NOTIFICATIONS

* Based on total product weight
* Not per batch

---

# 🧠 BEST PRACTICES

✔ Always scan before confirming
✔ Monitor low stock daily
✔ Avoid manual stock edits
✔ Use barcode for accuracy
✔ Check transactions if mismatch occurs

---

# 🆘 TROUBLESHOOTING

## ❌ Stock not updating

→ Ensure barcode was scanned in Verification

---

## ❌ Wrong remaining kg

→ Check:

* Multiple batches
* FIFO allocation

---

## ❌ Notifications mismatch

→ Verify totalRemainingWeight calculation

---

## ❌ N/A in transactions

→ Missing product reference (needs fix in data mapping)

---

# ✅ FINAL SUMMARY

| ROLE    | RESPONSIBILITY          |
| ------- | ----------------------- |
| Owner   | Monitor & decide        |
| Sales   | Create orders           |
| Encoder | Execute stock deduction |

---

# 🎉 YOU ARE READY TO USE THE SYSTEM

If everything is followed correctly:

✔ Accurate inventory
✔ Real-time tracking
✔ No stock mismatch
✔ Smooth operations
