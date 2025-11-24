# Client Setup Guide - 20 Laws of Feminine Power Guide

This guide is for the **client** who will be using this website to sell their PDF guide.

## What You Need to Do

### 1. Set Up Razorpay Account (Required)

**Why?** Razorpay handles all payments (GPay, PhonePe, Paytm, UPI, Cards, etc.) and automatically verifies them.

**Steps:**
1. Go to https://razorpay.com
2. Click "Sign Up" and create an account
3. Complete business verification (required for receiving payments)
4. Go to **Settings** → **API Keys**
5. Generate **Live Keys** (for real payments)
6. Copy your **Key ID** and **Key Secret**

**Cost:** Free for first ₹2 Lakhs, then 2% per transaction

### 2. Provide Your Razorpay Credentials

Send these to your developer:
- **Razorpay Key ID**: `rzp_live_xxxxxxxxxxxxx`
- **Razorpay Key Secret**: `xxxxxxxxxxxxxxxxxxxxx`

**Important:** Never share your Key Secret publicly. Only send it securely to your developer.

### 3. Your Payment Details

- **UPI ID**: `risthishende5@oksbi` (already configured)
- **Product Price**: ₹199 (already configured)
- **Product Name**: 20 Laws of Feminine Power Guide

### 4. Your PDF File

- The PDF file is already in place: `files/x9k3f2_20-laws.pdf`
- If you need to update it, replace this file with the same name

## How Payments Work

1. Customer clicks "Buy Now – ₹199"
2. Razorpay payment window opens
3. Customer pays via GPay, PhonePe, Paytm, UPI, Card, etc.
4. Payment is **automatically verified**
5. Customer gets download link immediately
6. You receive payment in your Razorpay account

## Accessing Your Payments

- Login to https://dashboard.razorpay.com
- Go to **Payments** to see all transactions
- Money is automatically transferred to your bank account (as per Razorpay settings)

## Testing (Before Going Live)

1. Use **Test Keys** from Razorpay dashboard
2. Test with Razorpay test cards: https://razorpay.com/docs/payments/test-cards/
3. Once everything works, switch to **Live Keys**

## Support

- Razorpay Support: https://razorpay.com/support/
- For website issues, contact your developer

---

**Note:** Your developer will handle the technical setup once you provide the Razorpay credentials.


