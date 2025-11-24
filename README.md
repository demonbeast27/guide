# 20 Laws of Feminine Power - Digital Guide Website

A secure web application for selling a digital PDF guide with Razorpay payment integration (supports GPay, PhonePe, Paytm, and all UPI apps).

**For Developers:** This is a client project. See setup instructions below.  
**For Clients:** See `CLIENT_SETUP.md` for what you need to do.

## Features

- ✅ **GPay/UPI Payment** - Direct UPI payment link and QR code
- ✅ **One-Time Download Links** - Secure, time-limited download tokens (24 hours)
- ✅ **Soft Feminine Design** - Beautiful, responsive UI with pink/beige aesthetic
- ✅ **Mobile-Friendly** - Fully responsive design
- ✅ **QR Code Support** - Scan to pay with any UPI app

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express.js
- **Payment**: Direct UPI/GPay links
- **Security**: Cryptographic token generation for secure downloads

## Setup Instructions

### 1. Prerequisites

- Node.js (v14 or higher)
- Razorpay account (sign up at https://razorpay.com)

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Razorpay (Required - Client Must Provide Credentials)

**For Developer:**
1. Ask your client to set up a Razorpay account (see `CLIENT_SETUP.md`)
2. Client will provide you with:
   - Razorpay Key ID
   - Razorpay Key Secret
3. **Create `.env` file** in the root directory:
   ```env
   RAZORPAY_KEY_ID=client_provided_key_id
   RAZORPAY_KEY_SECRET=client_provided_key_secret
   PORT=3000
   ```

**Important:** 
- Never commit `.env` file to git
- Use Test Keys for development, Live Keys for production
- Razorpay supports GPay, PhonePe, Paytm, and all UPI apps automatically

### 5. Add Your PDF File

Place your PDF file in the `files` directory:

```
files/x9k3f2_20-laws.pdf
```

If you use a different filename, update the path in `server.js` (around line 80).

### 6. Start the Server

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will run on `http://localhost:3000`

## Project Structure

```
guide/
├── public/
│   └── index.html          # Frontend HTML with UPI/GPay integration
├── files/
│   └── x9k3f2_20-laws.pdf  # Your PDF file (add this)
├── server.js               # Express backend with secure download
├── package.json            # Dependencies
├── .env                    # Environment variables (optional)
├── .gitignore             # Git ignore file
└── README.md              # This file
```

## API Endpoints

### `POST /api/get-download-link`
Generates a secure download token when user clicks "I've Paid".

**Response:**
```json
{
  "success": true,
  "downloadToken": "secure_token_here",
  "message": "Download link generated"
}
```

### `GET /api/download/:token`
Downloads the PDF file (one-time use, 24-hour expiry).

**Response:** PDF file download

### `POST /api/check-payment`
Check if a payment has been verified (optional, for polling).

## Security Features

1. **One-Time Download Links** - Each token can only be used once
2. **Time-Limited Tokens** - Download links expire after 24 hours
3. **Secure Token Generation** - Uses cryptographic random bytes
4. **Server-Side PDF Delivery** - PDF is not directly accessible via URL

## Deployment

### Deploy to Heroku

1. Install [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
2. Login: `heroku login`
3. Create app: `heroku create your-app-name`
4. Set environment variables:
   ```bash
   heroku config:set RAZORPAY_KEY_ID=your_key_id
   heroku config:set RAZORPAY_KEY_SECRET=your_key_secret
   ```
5. Deploy: `git push heroku main`

### Deploy to Railway

1. Connect your GitHub repository to Railway
2. Add environment variables in Railway dashboard
3. Deploy automatically

### Deploy to Vercel/Netlify

**Note**: These platforms are better for static sites. For this full-stack app, use:
- **Heroku**
- **Railway**
- **DigitalOcean App Platform**
- **AWS Elastic Beanstalk**
- **Google Cloud Run**

## Testing

1. Click "Buy Now" button to open UPI payment
2. Complete payment via your UPI app
3. Click "I've Paid" to get download link
4. Download the PDF using the secure token

## Troubleshooting

### Download Link Not Working

- Ensure PDF file exists in `files/` directory
- Check token hasn't expired (24 hours)
- Verify token hasn't been used already

### CORS Issues

If deploying frontend separately, add CORS middleware:
```javascript
const cors = require('cors');
app.use(cors());
```

## Important Notes

⚠️ **Security**: Never commit `.env` file to version control
⚠️ **Production**: Use environment variables for all sensitive data
⚠️ **Database**: For production, replace in-memory storage with a database (MongoDB, PostgreSQL)
⚠️ **HTTPS**: Always use HTTPS in production
⚠️ **Payment Verification**: This setup relies on user honesty. For automatic payment verification, consider integrating a payment gateway like Razorpay or Paytm.

## Support

For issues with this codebase, check server logs and browser console.

## License

ISC

