const { createClient } = require('@supabase/supabase-js');
const http = require('http');

// Render.com üzerinden gelen gizli değişkenler
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Hedef Mail Adresleri
const TARGET_EMAILS = ["kadirbalta.nrc@gmail.com", "nurcinneemir@gmail.com"];

// Supabase Bağlantısı
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Resend API Üzerinden Mail Gönderme Fonksiyonu (Port Engeline Takılmaz)
async function sendEmailViaResend(htmlContent) {
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Yonetim Paneli <onboarding@resend.dev>',
                to: TARGET_EMAILS,
                subject: '🔔 Geciken / Yaklaşan Ödeme Uyarısı',
                html: htmlContent
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(JSON.stringify(data));
        
        console.log("Uyarı maili Resend API ile başarıyla gönderildi!", data);
    } catch (err) {
        console.error("Resend Mail atma hatası:", err);
    }
}

// Veritabanını Kontrol Edip Mail Atan Fonksiyon
async function checkAndSendEmails() {
    try {
        const today = new Date().toISOString().split('T')[0];

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

            await sendEmailViaResend(mailContent);
        } else {
            console.log("Geciken veya yaklaşan ödeme bulunamadı.");
        }
    } catch (err) {
        console.error("Veritabanı kontrol hatası:", err);
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
    console.log('Arka plan mail servisi başlatıldı (Resend API)...');
});
