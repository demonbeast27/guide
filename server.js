const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const Razorpay = require('razorpay');
const cors = require('cors');
require('dotenv').config();

const app = express();
// Use Render-assigned PORT if present, otherwise default to 3000
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const DOWNLOAD_TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 hours
const DOWNLOAD_COOKIE_NAME = 'download_token';
const DOWNLOAD_COOKIE_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes
const PDF_FILENAME_ON_DISK = '20 laws of feminine power complete guide.pdf';
const PDF_DOWNLOAD_NAME = 'guide.pdf';
const PDF_PATH = path.join(__dirname, 'files', PDF_FILENAME_ON_DISK);

function streamGuidePdf(res) {
    const filePath = PDF_PATH;

    if (!fs.existsSync(filePath)) {
        console.error('PDF file missing at runtime:', filePath);
        return res.status(404).send('PDF not found');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${PDF_DOWNLOAD_NAME}"`);

    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Error sending PDF:', err);
            if (!res.headersSent) {
                res.status(500).send('Error downloading file');
            }
        }
    });
}

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

// Root should download the PDF immediately (used for Razorpay redirect)
app.get('/', (req, res) => {
    streamGuidePdf(res);
});

// Create Razorpay order (supports GPay/UPI)
app.post('/api/create-order', async (req, res) => {
    try {
        const amount = 19900;
        const options = {
            amount,
            currency: 'INR',
            receipt: `order_${Date.now()}`,
            notes: {
                product: '20 Laws of Feminine Power Guide',
                upi_id: 'risthishende5@oksbi'
            }
        };

        const order = await razorpay.orders.create(options);

        orders.set(order.id, {
            amount: order.amount,
            createdAt: new Date()
        });

        res.json({ id: order.id, amount: order.amount, currency: order.currency });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        console.log('Razorpay create-order error:', error && error.message);
        res.status(500).json({ message: 'Failed to create order' });
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

        // Verify signature using HMAC SHA256
        const text = `${razorpay_order_id}|${razorpay_payment_id}`;
        const generatedSignature = crypto
            .createHmac('sha256', RAZORPAY_KEY_SECRET)
            .update(text)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                status: 'error',
                message: 'Invalid payment signature'
            });
        }

        // Fetch payment status from Razorpay API (backend is source of truth)
        try {
            const payment = await razorpay.payments.fetch(razorpay_payment_id);

            // ONLY respond with success when status === "captured"
            if (payment.status === 'captured') {
                // Check if payment already processed
                const existingToken = Array.from(downloadTokens.entries()).find(
                    ([token, data]) => data.paymentId === razorpay_payment_id
                );

                if (existingToken) {
                    return res.json({
                        success: true,
                        status: 'captured',
                        downloadToken: existingToken[0]
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
                    amount: payment.amount / 100
                });

                console.log(`Payment verified: ${razorpay_payment_id} - Amount: ₹${payment.amount / 100} - Method: ${payment.method}`);

                return res.json({
                    success: true,
                    status: 'captured',
                    downloadToken: downloadToken
                });
            }

            // Not yet captured – return status but no success
            console.warn(`Payment not captured yet: ${razorpay_payment_id} - Status: ${payment.status}`);
            return res.json({
                success: false,
                status: payment.status,
                message: 'Payment not completed yet'
            });
        } catch (error) {
            console.error('Error verifying payment with Razorpay:', error);
            return res.status(500).json({
                success: false,
                status: 'error',
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
        if (typeof tokenData.used === 'undefined') {
            tokenData.used = false;
        }

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

        // Get PDF file path (make sure this matches the actual filename in the files/ directory)
        const pdfPath = path.join(__dirname, 'files', '20 laws of feminine power complete guide.pdf');

        // Check if PDF exists
        if (!fs.existsSync(pdfPath)) {
            console.error('PDF file not found at:', pdfPath);
            return res.status(404).json({
                success: false,
                message: 'PDF file not found. Please ensure the PDF file is placed in the files/ directory with the name: 20 laws of feminine power complete guide.pdf'
            });
        }

        // Send PDF file
        const filename = '20-Laws-of-Feminine-Power-Guide.pdf';
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        const fileStream = fs.createReadStream(pdfPath);
        fileStream.pipe(res);

        let completed = false;
        res.on('finish', () => {
            completed = true;
            tokenData.used = true;
            console.log(`PDF downloaded: Token ${token.substring(0, 8)}...`);
        });

        res.on('close', () => {
            if (!completed) {
                // download interrupted, allow retry
                tokenData.used = false;
                console.warn(`Download interrupted for token ${token.substring(0, 8)}..., allowing retry`);
            }
        });
    } catch (error) {
        console.error('Error downloading PDF:', error);
        res.status(500).json({
            success: false,
            message: 'Error downloading file'
        });
    }
});


// Direct PDF download route (production fallback)
app.get('/download', (req, res) => {
    streamGuidePdf(res);
});


// Check payment status and issue/download token if captured
app.get('/api/check-status', async (req, res) => {
    const { payment_id } = req.query;

    if (!payment_id) {
        return res.status(400).json({
            success: false,
            status: 'error',
            message: 'payment_id is required'
        });
    }

    try {
        const payment = await razorpay.payments.fetch(payment_id);

        // Return the actual status (captured/failed/pending)
        return res.json({
            success: payment.status === 'captured',
            status: payment.status,
            message: payment.status === 'captured' ? 'Payment captured' : `Payment status: ${payment.status}`
        });
    } catch (error) {
        console.error('Error checking payment status:', error);
        return res.status(500).json({
            success: false,
            status: 'error',
            message: 'Error checking payment status'
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server (single listener)
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
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



