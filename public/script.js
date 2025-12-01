// Preload QR for fallback UPI scanning
window.addEventListener('DOMContentLoaded', function () {
    const imgEl = document.getElementById('qr-code-image');
    if (imgEl) {
        const upiString = 'upi://pay?pa=risthishende5@oksbi&pn=Risthi&am=199&cu=INR&tn=20%20Laws%20Feminine%20Power%20Guide';
        const qrCodeUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(upiString);
        imgEl.src = qrCodeUrl;
    }
});

function toggleQR() {
    const qrSection = document.getElementById('qr-section');
    const showQrBtn = document.getElementById('show-qr-btn');
    if (!qrSection || !showQrBtn) return;
    const isActive = qrSection.classList.contains('active');
    if (isActive) {
        qrSection.classList.remove('active');
        showQrBtn.style.display = 'block';
    } else {
        qrSection.classList.add('active');
        showQrBtn.style.display = 'none';
    }
}

const API_BASE = 'https://guide-backend-2v7j.onrender.com';
const RAZORPAY_KEY_ID = 'rzp_live_RklZm6xcXA1csN';

async function initiatePayment() {
    const btn = document.getElementById('buy-now-btn');
    const originalText = btn.innerHTML;

    try {
        // Disable button so user can't double-click, but keep label the same
        btn.disabled = true;

        const orderResponse = await fetch(`${API_BASE}/api/create-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const orderData = await orderResponse.json();
        if (!orderData || !orderData.id) {
            throw new Error('Missing order_id');
        }
        if (!orderData.amount || orderData.amount < 100) {
            throw new Error('Invalid amount');
        }

        const options = {
            key: RAZORPAY_KEY_ID,
            amount: orderData.amount,
            currency: orderData.currency,
            name: 'PDF Purchase',
            description: 'Digital Download',
            order_id: orderData.id,
            methods: { upi: 1 },
            upi: { mode: 'intent', flow: 'intent' },
            redirect: true,
            callback_url: `${API_BASE}/download-pdf`,
            modal: {
                ondismiss: function () {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                }
            }
        };

        const razorpay = new Razorpay(options);
        razorpay.open();
        // Re‑enable button after Razorpay widget is opened
        btn.disabled = false;

    } catch (error) {
        console.error(error);
        showMessage(error.message || 'Payment initialization failed. Please try again.', 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// Using Razorpay redirect + callback_url; no frontend verification or confirmations

function showMessage(text, type = 'error') {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = `message ${type} active`;
    setTimeout(() => messageEl.classList.remove('active'), 5000);
}

function showDownloadSection(downloadToken, autoDownload = false) {
    const downloadSection = document.getElementById('download-section');
    const downloadLink = document.getElementById('download-link');
    const downloadUrl = `${API_BASE}/api/download/${downloadToken}`;
    downloadLink.href = downloadUrl;
    downloadSection.classList.add('active');
    setTimeout(() => downloadSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    const buyBtn = document.getElementById('buy-now-btn');
    if (buyBtn) buyBtn.style.display = 'none';

    if (autoDownload) {
        // Initiate PDF download automatically without extra click
        const tempLink = document.createElement('a');
        tempLink.href = downloadUrl;
        tempLink.download = '20-Laws-of-Feminine-Power-Guide.pdf';
        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
    }
}


