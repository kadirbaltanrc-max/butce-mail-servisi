const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const http = require('http');

// Render.com üzerinden eklenecek gizli çevresel değişkenler
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS; 

// Sabitlenmiş Hedef Mail Adresleri (Virgül ile ayrılmış)
const TARGET_EMAILS = "kadirbalta.nrc@gmail.com, nurcinneemir@gmail.com";

// Supabase ve Mail Bağlantıları
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: GMAIL_USER,
        pass: GMAIL_PASS
    }
});

// Veritabanını Kontrol Edip Mail Atan Fonksiyon
async function checkAndSendEmails() {
    try {
        const today = new Date().toISOString().split('T')[0];

        // is_paid = false olan ve due_date bugüne eşit veya geçmiş olanları çek
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .eq('is_paid', false)
            .lte('due_date', today);

        if (error) throw error;

        if (data && data.length > 0) {
            let mailContent = `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #dc2626;">⚠️ Yaklaşan veya Geciken Ödemeleriniz Var!</h2>
                    <p style="color: #374151; font-size: 16px;">Sisteme kayıtlı, vadesi gelmiş veya geçmiş ödemeleriniz aşağıda listelenmiştir:</p>
                    <ul style="font-size: 15px; color: #111827; background: #f9fafb; padding: 15px 15px 15px 35px; border-radius: 5px;">
            `;
            
            data.forEach(exp => {
                const [y, m, d] = exp.due_date.split('-');
                const trDate = `${d}/${m}/${y}`;
                mailContent += `<li style="margin-bottom: 8px;"><strong>${exp.name}</strong> - <span style="color:#dc2626; font-weight:bold;">${exp.amount} ₺</span> (Son Ödeme: ${trDate})</li>`;
            });

            mailContent += `
                    </ul>
                    <p style="color: #4b5563; font-size: 14px; margin-top: 20px;">Lütfen Yönetim Paneli üzerinden kontrollerinizi sağlayınız.</p>
                </div>
            `;

            const mailOptions = {
                from: `"Yönetim Paneli" <${GMAIL_USER}>`,
                to: TARGET_EMAILS, // Doğrudan sabitlenmiş adresleri kullanır
                subject: '🔔 Geciken / Yaklaşan Ödeme Uyarısı',
                html: mailContent
            };

            await transporter.sendMail(mailOptions);
            console.log("Uyarı maili her iki adrese de başarıyla gönderildi!");
        } else {
            console.log("Geciken veya yaklaşan ödeme bulunamadı.");
        }
    } catch (err) {
        console.error("Mail atma hatası:", err);
    }
}

// Basit HTTP Sunucusu (Cron Job Tetiklemesi İçin)
const server = http.createServer(async (req, res) => {
    if (req.url === '/tetikle') {
        console.log("Manuel tetikleme alındı, kontroller yapılıyor...");
        await checkAndSendEmails();
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Veritabanı kontrol edildi. Gerekliyse mailler gönderildi.');
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Servis çalışıyor. Tetiklemek için /tetikle rotasına gidin.');
    }
});

server.listen(process.env.PORT || 3000, () => {
    console.log('Arka plan mail servisi başlatıldı...');
});