const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const Razorpay = require('razorpay');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Razorpay (supports GPay, PhonePe, Paytm, and all UPI apps)
const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.error('\n❌ Razorpay keys missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env before launching.\n');
    process.exit(1);
}

const razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET
});

// Middleware
app.use(cors()); // allow cross-origin (frontend hosted elsewhere)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// In-memory store for download tokens and orders
// In production, use a database (MongoDB, PostgreSQL, etc.)
const downloadTokens = new Map(); // downloadToken -> { used: false, createdAt: Date }
const usedTransactions = new Set(); // Track used transaction IDs to prevent reuse
const orders = new Map(); // orderId -> { amount, createdAt }

// Generate secure random token
function generateDownloadToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Clean up old tokens (older than 24 hours)
function cleanupOldTokens() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [token, data] of downloadTokens.entries()) {
        if (now - data.createdAt.getTime() > maxAge) {
            downloadTokens.delete(token);
        }
    }
}

// Run cleanup every hour
setInterval(cleanupOldTokens, 60 * 60 * 1000);

// Routes

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Create Razorpay order (supports GPay/UPI)
app.post('/api/create-order', async (req, res) => {
    try {
        const amount = 19900; // ₹199 in paise
        
        const options = {
            amount: amount,
            currency: 'INR',
            receipt: `order_${Date.now()}`,
            notes: {
                product: '20 Laws of Feminine Power Guide',
                upi_id: 'risthishende5@oksbi'
            }
        };

        const order = await razorpay.orders.create(options);
        
        // Store order
        orders.set(order.id, {
            amount: order.amount,
            createdAt: new Date()
        });
        
        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID || razorpay.key_id
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create order. Please try again.'
        });
    }
});

// Verify Razorpay payment (automatic verification for GPay/UPI)
app.post('/api/verify-payment', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Missing payment details'
            });
        }

        // Verify signature
        const text = `${razorpay_order_id}|${razorpay_payment_id}`;
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || razorpay.key_secret)
            .update(text)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }

        // Verify payment with Razorpay API
        try {
            const payment = await razorpay.payments.fetch(razorpay_payment_id);
            
            if (payment.status !== 'authorized' && payment.status !== 'captured') {
                return res.status(400).json({
                    success: false,
                    message: 'Payment not successful'
                });
            }

            // Check if payment already processed
            const existingToken = Array.from(downloadTokens.entries()).find(
                ([token, data]) => data.paymentId === razorpay_payment_id
            );

            if (existingToken) {
                return res.json({
                    success: true,
                    downloadToken: existingToken[0],
                    message: 'Payment already verified'
                });
            }

            // Generate one-time download token
            const downloadToken = generateDownloadToken();
            
            // Store download token
            downloadTokens.set(downloadToken, {
                used: false,
                createdAt: new Date(),
                paymentId: razorpay_payment_id,
                orderId: razorpay_order_id,
                amount: payment.amount / 100 // Convert paise to rupees
            });

            console.log(`Payment verified: ${razorpay_payment_id} - Amount: ₹${payment.amount / 100} - Method: ${payment.method}`);

            res.json({
                success: true,
                downloadToken: downloadToken,
                message: 'Payment verified successfully'
            });
        } catch (error) {
            console.error('Error verifying payment with Razorpay:', error);
            return res.status(500).json({
                success: false,
                message: 'Error verifying payment with payment gateway'
            });
        }
    } catch (error) {
        console.error('Error in verify-payment:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Verify transaction and generate download link
app.post('/api/verify-transaction', (req, res) => {
    try {
        const { transactionId, amount } = req.body;

        if (!transactionId || !transactionId.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Transaction ID is required'
            });
        }

        const txIdTrimmed = transactionId.trim();
        const txIdUpper = txIdTrimmed.toUpperCase();

        // TEST MODE: Allow test transaction ID (can be reused)
        const TEST_TRANSACTION_ID = 'tilakpirate1234@oksbi';
        const isTestMode = txIdTrimmed.toLowerCase() === TEST_TRANSACTION_ID.toLowerCase();
        
        if (isTestMode) {
            console.log('TEST MODE: Test transaction ID accepted -', txIdTrimmed);
            // Test ID can be reused, so don't add to usedTransactions
        } else {
            // Validate transaction ID format
            // UPI transaction IDs are typically alphanumeric, 6-30 characters
            // Can contain numbers, letters, and sometimes special characters
            const txIdRegex = /^[A-Za-z0-9]{6,30}$/;
            
            if (!txIdRegex.test(txIdTrimmed)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid Transaction ID format. Please enter a valid UPI Transaction ID (6-30 alphanumeric characters).'
                });
            }

            // Check if this transaction ID was already used
            if (usedTransactions.has(txIdUpper)) {
                return res.status(400).json({
                    success: false,
                    message: 'This Transaction ID has already been used. Each payment can only be used once.'
                });
            }

            // Mark transaction as used
            usedTransactions.add(txIdUpper);
            
            // Log the transaction for verification
            console.log(`Payment received - Transaction ID: ${txIdTrimmed}, Amount: ₹${amount || 199}, UPI: risthishende5@oksbi`);
            
            // NOTE: In production, you should:
            // 1. Verify this transaction ID against your UPI payment records
            // 2. Check that the amount is exactly ₹199
            // 3. Verify the transaction was successful
            // 4. Consider using a payment gateway (Razorpay, Paytm) for automatic verification
        }

        // Generate one-time download token
        const downloadToken = generateDownloadToken();
        
        // Store download token (24 hour expiry)
        downloadTokens.set(downloadToken, {
            used: false,
            createdAt: new Date(),
            transactionId: transactionId.trim()
        });

        console.log(`Transaction verified: ${transactionId.substring(0, 6)}... - Token generated`);

        res.json({
            success: true,
            downloadToken: downloadToken,
            message: 'Transaction verified successfully'
        });
    } catch (error) {
        console.error('Error verifying transaction:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during verification'
        });
    }
});

// Download PDF (protected route)
app.get('/api/download/:token', (req, res) => {
    try {
        const token = req.params.token;

        // Check if token exists
        if (!downloadTokens.has(token)) {
            return res.status(404).json({
                success: false,
                message: 'Invalid or expired download link'
            });
        }

        const tokenData = downloadTokens.get(token);

        // Check if token is already used (one-time use)
        if (tokenData.used) {
            return res.status(403).json({
                success: false,
                message: 'This download link has already been used'
            });
        }

        // Check if token is expired (24 hours)
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        if (now - tokenData.createdAt.getTime() > maxAge) {
            downloadTokens.delete(token);
            return res.status(403).json({
                success: false,
                message: 'Download link has expired'
            });
        }

        // Mark token as used
        tokenData.used = true;

        // Get PDF file path
        const pdfPath = path.join(__dirname, 'files', 'x9k3f2_20-laws.pdf');

        // Check if PDF exists
        if (!fs.existsSync(pdfPath)) {
            console.error('PDF file not found at:', pdfPath);
            return res.status(404).json({
                success: false,
                message: 'PDF file not found. Please ensure the PDF file is placed in the files/ directory with the name x9k3f2_20-laws.pdf'
            });
        }

        // Send PDF file
        const filename = '20-Laws-of-Feminine-Power-Guide.pdf';
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        const fileStream = fs.createReadStream(pdfPath);
        fileStream.pipe(res);

        // Log download (optional)
        console.log(`PDF downloaded: Token ${token.substring(0, 8)}...`);
    } catch (error) {
        console.error('Error downloading PDF:', error);
        res.status(500).json({
            success: false,
            message: 'Error downloading file'
        });
    }
});


// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Make sure to place your PDF file in the files/ directory');
    
    // Check if Razorpay keys are configured
    if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'rzp_test_1234567890') {
        console.warn('\n⚠️  WARNING: Razorpay keys not configured!');
        console.warn('Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env file');
        console.warn('Get keys from: https://dashboard.razorpay.com/app/keys\n');
    } else {
        console.log('✅ Razorpay configured');
    }
});

