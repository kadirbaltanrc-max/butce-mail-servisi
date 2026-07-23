const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Render.com Üzerinden Alınan Gizli Çevresel Değişkenler
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Supabase İstemci Bağlantısı
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Resend API Üzerinden Mail Gönderme Fonksiyonu
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
                to: 'kadirbalta.nrc@gmail.com', // Sadece Onaylı Adres
                subject: '🔔 Geciken / Yaklaşan Ödeme Uyarısı',
                html: htmlContent
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(JSON.stringify(data));
        console.log("Uyarı maili Resend API ile başarıyla gönderildi!");
    } catch (err) {
        console.error("Resend Mail atma hatası:", err);
    }
}

// Veritabanı Giderlerini Kontrol Etme Fonksiyonu
async function checkAndSendEmails() {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Ödenmemiş ve son ödeme tarihi gelmiş/geçmiş olanları bul
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
                const [y, m, d] = (exp.due_date || '').split('-');
                const trDate = d ? `${d}/${m}/${y}` : 'Tarih Yok';
                mailContent += `<li style="margin-bottom: 8px;"><strong>${exp.name}</strong> - <span style="color:#dc2626; font-weight:bold;">${exp.amount} ₺</span> (Son Ödeme: ${trDate})</li>`;
            });

            mailContent += `</ul></div>`;
            await sendEmailViaResend(mailContent);
        } else {
            console.log("Geciken veya yaklaşan ödeme bulunamadı, mail atılmadı.");
        }
    } catch (err) {
        console.error("Veritabanı kontrol hatası:", err);
    }
}

// Ana HTTP Sunucusu (API + Frontend Dosya Sunumu)
const server = http.createServer(async (req, res) => {
    // 1. Görev: Mail Kontrol / Tetikleme Rotası
    if (req.url === '/tetikle') {
        await checkAndSendEmails();
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Tetikleme başarılı. Veritabanı kontrol edildi.');
        return;
    } 
    
    // 2. Görev: PWA ve Frontend Dosyalarını Ekrana Basma
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    // Güvenli MIME tipleri (Tarayıcının dosyaları doğru tanıması için şarttır)
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.png': 'image/png'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // Dosyayı sunucu diskinden okuyup tarayıcıya yolla
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('404: Aranan dosya sunucuda bulunamadı.');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(`500: Kritik Sunucu Hatası -> ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Sunucuyu Render.com portlarında dinlemeye başlat
server.listen(process.env.PORT || 3000, () => {
    console.log('Güvenli Sunucu Başlatıldı: Frontend, PWA ve Arka Plan Mail Servisi Aktif');
});
