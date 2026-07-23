const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Çevresel Değişkenler
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Supabase Bağlantısı
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Resend API ile E-posta Gönderimi
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
                to: 'kadirbalta.nrc@gmail.com',
                subject: '🔔 Geciken / Yaklaşan Ödeme Uyarısı',
                html: htmlContent
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(JSON.stringify(data));
        console.log("Uyarı maili başarıyla gönderildi!", data);
    } catch (err) {
        console.error("Resend Mail atma hatası:", err);
    }
}

// Veritabanı Kontrolü (Cron Görevi)
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
                    <ul style="font-size: 15px; color: #111827; background: #f9fafb; padding: 15px 15px 15px 35px; border-radius: 5px;">
            `;
            
            data.forEach(exp => {
                const [y, m, d] = exp.due_date.split('-');
                mailContent += `<li style="margin-bottom: 8px;"><strong>${exp.name}</strong> - <span style="color:#dc2626; font-weight:bold;">${exp.amount} ₺</span> (Son Ödeme: ${d}/${m}/${y})</li>`;
            });

            mailContent += `</ul></div>`;
            await sendEmailViaResend(mailContent);
        } else {
            console.log("Geciken veya yaklaşan ödeme bulunamadı.");
        }
    } catch (err) {
        console.error("Veritabanı kontrol hatası:", err);
    }
}

// HTTP Sunucusu (API + Statik Dosya Sunucusu)
const server = http.createServer(async (req, res) => {
    // API Rotası: Manuel veya Cron Tetikleme
    if (req.url === '/tetikle') {
        await checkAndSendEmails();
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Tetikleme başarılı. Gerekliyse mailler gönderildi.');
        return;
    } 
    
    // Front-End Statik Dosya Yönlendirmesi
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    // Modern Web için MIME Tipleri
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.png': 'image/png'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // Dosyayı Oku ve Sun
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('404: Dosya bulunamadı.');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(`Sunucu Hatası: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(process.env.PORT || 3000, () => {
    console.log('Sunucu Başlatıldı: HTML Arayüzü ve Mail Servisi Aktif');
});
