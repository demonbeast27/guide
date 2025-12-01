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
            handler: verifyPayment,
            modal: {
                ondismiss: function () {
                    alert('Payment cancelled.');
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

function verifyPayment(response) {
    console.log('Rzp Response:', response);

    fetch(`${API_BASE}/api/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response)
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'captured') {
            window.location.href = `${API_BASE}/download-pdf`;
        } else {
            // Retry after 2 seconds because UPI callbacks are delayed
            setTimeout(() => {
                fetch(`${API_BASE}/api/check-status?payment_id=${encodeURIComponent(response.razorpay_payment_id)}`)
                    .then(r => r.json())
                    .then(s => {
                        if (s.status === 'captured') {
                            window.location.href = `${API_BASE}/download-pdf`;
                        } else {
                            alert('Payment not completed.');
                        }
                    });
            }, 2000);
        }
    })
    .catch(error => {
        console.error('Verification error:', error);
        alert('Payment verification failed. Please contact support with your payment ID.');
    });
}

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


