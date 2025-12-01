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
        if (!orderData.success) {
            throw new Error(orderData.message || 'Unable to create order');
        }

        const options = {
            key: orderData.key,
            amount: orderData.amount,
            currency: orderData.currency,
            name: '20 Laws of Feminine Power',
            description: 'Complete PDF Guide',
            order_id: orderData.orderId,
            // Force UPI intent flow so GPay/UPI apps open directly
            method: 'upi',
            upi: {
                flow: 'intent'
            },
            handler: verifyPayment,
            notes: {
                product: '20 Laws of Feminine Power',
                upi: 'risthishende5@oksbi'
            },
            theme: { color: '#5d4037' },
            modal: {
                ondismiss: () => {
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

async function verifyPayment(response) {
    const btn = document.getElementById('buy-now-btn');
    const originalText = btn.innerHTML;
    try {
        btn.disabled = true;

        // Always send to backend; frontend does not decide success/failure
        const verifyRes = await fetch(`${API_BASE}/api/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response)
        });

        const verifyData = await verifyRes.json();

        if (verifyData.success && verifyData.downloadToken) {
            // Backend says payment is captured/authorized and token is ready
            showDownloadSection(verifyData.downloadToken, true);
            showMessage('Payment successful! Your download is ready.', 'success');
            btn.disabled = false;
            btn.innerHTML = originalText;
            return;
        }

        // If not yet captured, retry once after 2 seconds by checking status from backend
        setTimeout(async () => {
            try {
                const statusRes = await fetch(`${API_BASE}/api/check-status?payment_id=${encodeURIComponent(response.razorpay_payment_id)}`);
                const statusData = await statusRes.json();

                if (statusData.success && statusData.downloadToken && statusData.status === 'captured') {
                    showDownloadSection(statusData.downloadToken, true);
                    showMessage('Payment successful! Your download is ready.', 'success');
                } else {
                    showMessage('Payment not completed. If money is debited, please contact support with your payment ID.', 'error');
                }
            } catch (err) {
                console.error(err);
                showMessage('Could not confirm payment status. Please contact support with your payment ID.', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }, 2000);

    } catch (error) {
        console.error(error);
        showMessage(error.message || 'Verification failed. Contact support with your payment ID.', 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
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


