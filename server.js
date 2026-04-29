const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Store OTPs in memory
const otpStore = new Map();

// Email configuration (সরাসরি কোডে credentials বসানো)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'mdshihab999777@gmail.com',
        pass: 'wyzcaotqkgqivzdo'
    }
});

console.log('✅ Email credentials loaded');

// Rate limiting
const emailLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    message: { success: false, error: 'Too many requests. Please wait a minute.' }
});

// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send email with OTP
async function sendOTPEmail(email, otp) {
    const mailOptions = {
        from: '"Weblix Support" <mdshihab999777@gmail.com>',
        to: email,
        subject: '🔐 Password Reset Code - Weblix',
        html: `
            <div style="background:#0C0B19; padding:40px 20px; font-family:Arial,sans-serif;">
                <div style="max-width:450px; margin:0 auto; background:linear-gradient(135deg,#1A1A2E 0%,#16213E 100%); border-radius:24px; padding:35px; text-align:center;">
                    <div style="font-size:48px; margin-bottom:15px;">🔐</div>
                    <h1 style="color:#6200EE; margin:0; font-size:28px;">Weblix</h1>
                    <p style="color:#A0A0B0; margin:10px 0 20px;">Password Reset Request</p>
                    
                    <div style="background:#0C0B19; border-radius:16px; padding:20px; margin:20px 0;">
                        <p style="color:#FFFFFF; margin:0 0 10px;">Your verification code is:</p>
                        <div style="font-size:36px; letter-spacing:5px; font-weight:bold; color:#6200EE; font-family:monospace;">${otp}</div>
                        <p style="color:#808090; font-size:12px; margin:15px 0 0;">⏰ Expires in 10 minutes</p>
                    </div>
                    
                    <p style="color:#A0A0B0; font-size:13px;">Enter this code in the app to reset your password.</p>
                    <p style="color:#FF6D00; font-size:12px; margin-top:15px;">⚠️ Never share this code with anyone</p>
                    
                    <div style="border-top:1px solid #333; margin-top:25px; padding-top:20px;">
                        <p style="color:#606070; font-size:11px;">&copy; 2024 Weblix. All rights reserved.</p>
                    </div>
                </div>
            </div>
        `,
        text: `Weblix Password Reset\n\nYour OTP code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, please ignore this email.`
    };
    
    await transporter.sendMail(mailOptions);
}

// ==================== API ENDPOINTS ====================

app.get('/', (req, res) => {
    res.json({ status: 'running', message: 'Weblix Password Reset API is active' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Send OTP endpoint
app.post('/send-otp', emailLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email is required' });
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, error: 'Invalid email format' });
        }
        
        const existing = otpStore.get(email);
        if (existing && existing.attempts >= 3) {
            return res.status(429).json({ success: false, error: 'Too many attempts. Please try after 10 minutes.' });
        }
        
        const otp = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000;
        
        otpStore.set(email, {
            otp: otp,
            expiresAt: expiresAt,
            attempts: (existing?.attempts || 0) + 1,
            createdAt: Date.now()
        });
        
        setTimeout(() => otpStore.delete(email), 10 * 60 * 1000);
        
        await sendOTPEmail(email, otp);
        console.log(`✅ OTP sent to ${email}: ${otp}`);
        
        res.json({ success: true, message: 'OTP sent successfully to your email' });
        
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Verify OTP endpoint
app.post('/verify', async (req, res) => {
    try {
        const { email, otp } = req.body;
        
        if (!email || !otp) {
            return res.status(400).json({ success: false, error: 'Email and OTP are required' });
        }
        
        const storedData = otpStore.get(email);
        
        if (!storedData) {
            return res.status(400).json({ success: false, error: 'No OTP request found. Please request a new code.' });
        }
        
        if (Date.now() > storedData.expiresAt) {
            otpStore.delete(email);
            return res.status(400).json({ success: false, error: 'OTP expired. Please request a new code.' });
        }
        
        if (storedData.otp !== otp) {
            return res.status(400).json({ success: false, error: 'Invalid OTP. Please try again.' });
        }
        
        const resetToken = Buffer.from(`${email}:${Date.now()}`).toString('base64');
        otpStore.delete(email);
        
        res.json({ 
            success: true, 
            message: 'OTP verified successfully',
            resetToken: resetToken
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Clean up expired OTPs every minute
setInterval(() => {
    const now = Date.now();
    for (const [email, data] of otpStore.entries()) {
        if (now > data.expiresAt) otpStore.delete(email);
    }
}, 60 * 1000);

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📧 Email service using: mdshihab999777@gmail.com`);
    console.log(`✅ Health check: http://localhost:${PORT}/health`);
});