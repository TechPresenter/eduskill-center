# EduSkill Center — VPS Deployment Guide

**लक्ष्य:** आपके VPS पर पहले से चल रही `https://eduskillindia.org` वेबसाइट को **बिना छुए**, इस नए
प्रोजेक्ट को एक अलग folder `center` में deploy करना, ताकि वह यहाँ खुले:

```
https://eduskillindia.org/center
```

> **सबसे ज़रूरी बात:** मौजूदा वेबसाइट की एक भी file, उसका database, या उसका SSL certificate
> बदला नहीं जाएगा। सिर्फ़ उसके web-server config में **एक नया block जोड़ा** जाएगा (कुछ भी
> हटाया या बदला नहीं जाएगा)। पूरी list नीचे section 13 में है।

यह app एक **Node.js server** है (static HTML नहीं), इसलिए इसे अपने port (3001) पर एक service
की तरह चलाना होगा और web server उसे `/center` पर proxy करेगा।

---

## विषय-सूची

| # | Step |
|---|------|
| 1 | Prerequisites (पहले यह जाँच लें) |
| 2 | Folder बनाना |
| 3 | Project copy करना |
| 4 | Database बनाना |
| 5 | `.env` setup |
| 6 | Dependencies + migrations + seed |
| 7 | Build (`BASE_PATH=/center`) |
| 8 | systemd service install |
| 9 | Web server block जोड़ना (nginx / Apache) |
| 10 | पहली बार login |
| 11 | Verification checklist |
| 12 | अगली बार update कैसे करें |
| 13 | मौजूदा वेबसाइट पर कोई असर नहीं |
| 14 | Rollback |
| 15 | Troubleshooting |
| 16 | विकल्प: subdomain |
| 17 | AI सहायक (चैटबॉट) चालू करना |

---

## 1. Prerequisites — पहले यह जाँच लें

SSH से server पर login करके ये commands चलाएँ:

```bash
node -v                 # v20 या उससे नया होना चाहिए (v24 सबसे अच्छा)
npm -v
psql --version          # PostgreSQL 14+ चाहिए
df -h /var/www          # कम से कम 3 GB खाली जगह चाहिए
```

**कौन सा web server चल रहा है?** यह पता करना ज़रूरी है — step 9 उसी पर निर्भर है:

```bash
systemctl status nginx 2>/dev/null | head -3
systemctl status apache2 2>/dev/null | head -3
systemctl status httpd 2>/dev/null | head -3     # RHEL/AlmaLinux/CentOS
```

- अगर **cPanel / Plesk / CyberPanel / aaPanel** जैसा control panel है, तो अंदर आमतौर पर
  Apache या nginx (या दोनों) ही होते हैं। ऐसे panel में config file हाथ से edit करने के बजाय
  panel के "Custom Apache/nginx configuration" या "Proxy / Reverse Proxy" section का
  इस्तेमाल करें — वहीं पर step 9 वाला block paste करें, वरना panel अगली बार config
  regenerate करके आपका बदलाव मिटा देगा।

अगर Node 20+ नहीं है:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## 2. Folder बनाना

जैसा आपने कहा, folder का नाम **`center`** ही रहेगा:

```bash
sudo mkdir -p /var/www/center
```

**अगर आप control panel इस्तेमाल करते हैं** और सब कुछ home directory में रहता है, तो path
इसके बजाय ऐसा हो सकता है:

```
/home/eduskillindia/apps/center          # cPanel/CyberPanel जैसा layout
```

आगे जहाँ भी `<APP_DIR>` लिखा है, वहाँ अपना असली path लिखें। नीचे सभी उदाहरणों में
`<APP_DIR>` = `/var/www/center` मान लिया गया है।

> **ध्यान दें:** यह folder मौजूदा वेबसाइट की document root (जैसे `/var/www/eduskillindia.org`
> या `/home/.../public_html`) के **अंदर मत बनाइए**। अलग folder रखने से दोनों पूरी तरह
> स्वतंत्र रहेंगे। URL में `/center` दिखने के लिए folder का वहाँ होना ज़रूरी नहीं है —
> वह काम step 9 का proxy block करेगा।

अब app के लिए एक अलग (non-root) user बनाएँ:

```bash
sudo useradd --system --home /var/www/center --shell /usr/sbin/nologin eduskill
```

---

## 3. Project copy करना

**तरीका A — git (सुझाया गया):**

```bash
sudo git clone <YOUR_REPO_URL> /var/www/center
```

**तरीका B — अपने computer से rsync:**

```bash
# अपने local machine पर, project folder के अंदर से चलाएँ
rsync -av --delete \
  --exclude node_modules --exclude .next --exclude .env --exclude storage \
  ./ user@your-vps:/var/www/center/
```

फिर ownership सही करें:

```bash
sudo chown -R eduskill:eduskill /var/www/center
```

---

## 4. Database बनाना (नया database, नया user)

मौजूदा वेबसाइट का database **बिल्कुल नहीं छुआ जाएगा** — यह एक अलग database है।

पहले एक मज़बूत password बनाएँ:

```bash
openssl rand -base64 32 | tr -d '/+=' | cut -c1-32
```

`deploy/postgres-setup.sql` खोलकर `<DB_PASSWORD>` की जगह वही password लिखें, फिर:

```bash
sudo -u postgres psql -f /var/www/center/deploy/postgres-setup.sql
```

जाँच करें कि connection बन रहा है:

```bash
psql "postgresql://eduskill_center:<DB_PASSWORD>@127.0.0.1:5432/eduskill_center" \
     -c "select current_database(), current_user;"
```

---

## 5. `.env` setup

```bash
cd /var/www/center
sudo -u eduskill cp deploy/.env.production.example .env
sudo -u eduskill nano .env
```

कम से कम ये भरें (बाकी की पूरी list उसी file में comments के साथ है):

| Variable | Value |
|---|---|
| `BASE_PATH` | `"/center"` |
| `APP_URL` | `"https://eduskillindia.org/center"` |
| `PORT` | `3001` |
| `DATABASE_URL` | step 4 वाला |
| `AUTH_SECRET` | नीचे वाली command से बनाएँ |
| `SEED_SUPER_ADMIN_EMAIL` / `..._PASSWORD` | पहला admin |
| `SEED_DEMO` | `"false"` — production में demo data नहीं चाहिए |

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

File को सुरक्षित करें:

```bash
sudo chmod 600 .env && sudo chown eduskill:eduskill .env
```

> `BASE_PATH` एक **build-time** value है। इसे बदलने के बाद सिर्फ़ service restart करना
> काफ़ी नहीं — दोबारा `npm run build` चलाना पड़ेगा (step 7)।
>
> `APP_URL` में `/center` रहना ज़रूरी है, वरना emails, sitemap और certificate के QR code
> में गलत link जाएगा।

---

## 6. Dependencies, migrations और seed

```bash
cd /var/www/center

# devDependencies भी चाहिए (build के लिए) — इसलिए --omit=dev मत लगाइए
sudo -u eduskill npm ci

# Database tables बनाएँ (यह सिर्फ़ नई migrations लगाता है, कुछ मिटाता नहीं)
sudo -u eduskill npm run db:deploy

# States/districts/blocks, platform defaults, CMS sections + Super Admin
sudo -u eduskill npm run db:seed
```

> ⚠️ **`prisma migrate reset` या `npm run db:reset` server पर कभी मत चलाइए** — वे सारा
> data मिटा देते हैं। वे सिर्फ़ local development के लिए हैं।

`SEED_DEMO="false"` होने से कोई नकली student, trainer या center नहीं बनेगा — सिर्फ़
ज़रूरी reference data और आपका Super Admin account बनेगा।

---

## 7. Build

```bash
cd /var/www/center
sudo -u eduskill env BASE_PATH="/center" NODE_ENV=production npm run build
```

Build खत्म होने पर storage folder बना लें (documents यहीं upload होंगे):

```bash
sudo -u eduskill mkdir -p /var/www/center/storage
```

एक बार हाथ से test करें:

```bash
sudo -u eduskill env PORT=3001 npm run start
# दूसरी terminal में:
curl -I http://127.0.0.1:3001/center/
# HTTP/1.1 200 आना चाहिए। फिर पहली terminal में Ctrl+C दबाएँ।
```

---

## 8. systemd service install करना

```bash
sudo cp /var/www/center/deploy/eduskill-center.service /etc/systemd/system/
sudo nano /etc/systemd/system/eduskill-center.service
```

File में `<APP_DIR>` → `/var/www/center` और `<APP_USER>` → `eduskill` कर दें।
`which npm` चलाकर `ExecStart` में npm का सही path भी जाँच लें।

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now eduskill-center
sudo systemctl status eduskill-center          # "active (running)" दिखना चाहिए
curl -I http://127.0.0.1:3001/center/          # 200 आना चाहिए
journalctl -u eduskill-center -n 50 --no-pager # कोई error तो नहीं?
```

> PM2 पसंद है? तब systemd की जगह `deploy/ecosystem.config.cjs` इस्तेमाल करें।
> **दोनों एक साथ मत चलाइए** — दोनों port 3001 माँगेंगे और टकरा जाएँगे।

---

## 9. Web server में block जोड़ना (यही असली step है)

### 9.1 पहले backup लें — यह step छोड़िए मत

```bash
# nginx
sudo cp /etc/nginx/sites-available/eduskillindia.org \
        /etc/nginx/sites-available/eduskillindia.org.bak.$(date +%F-%H%M)

# Apache (Debian/Ubuntu)
sudo cp /etc/apache2/sites-available/eduskillindia.org-le-ssl.conf \
        /etc/apache2/sites-available/eduskillindia.org-le-ssl.conf.bak.$(date +%F-%H%M)
```

File का नाम अलग हो सकता है — `sudo nginx -T | grep -n "eduskillindia"` या
`sudo apachectl -S` से असली file ढूँढ़ें।

### 9.2 nginx

`deploy/nginx-center.conf` खोलें और उसके अंदर का block **मौजूदा `server { ... }`
(जो 443 पर eduskillindia.org को serve करता है) के अंदर** copy-paste करें।
उस file में और कुछ मत बदलें।

```bash
sudo nano /etc/nginx/sites-available/eduskillindia.org
sudo nginx -t                      # यह ज़रूर pass होना चाहिए
sudo systemctl reload nginx        # reload — restart नहीं
```

> `nginx -t` fail हो तो backup वापस रख दें और फिर से reload करें। जब तक reload
> सफल न हो, पुराना config ही चलता रहता है — यानी मौजूदा साइट कभी बंद नहीं होती।

### 9.3 Apache

पहले modules enable करें (यह एक बार का काम है और इसके लिए restart चाहिए):

```bash
sudo a2enmod proxy proxy_http headers rewrite
sudo systemctl restart apache2
```

फिर `deploy/apache-center.conf` का block मौजूदा `<VirtualHost *:443>` के अंदर paste करें:

```bash
sudo nano /etc/apache2/sites-available/eduskillindia.org-le-ssl.conf
sudo apachectl configtest          # "Syntax OK" आना चाहिए
sudo systemctl reload apache2      # reload — restart नहीं
```

### 9.4 अब browser में खोलें

```
https://eduskillindia.org/center
```

साथ ही यह भी जाँचें कि पुरानी साइट ज्यों की त्यों चल रही है:

```
https://eduskillindia.org
```

---

## 10. पहली बार login

1. `https://eduskillindia.org/center/login` खोलें।
2. `.env` वाले `SEED_SUPER_ADMIN_EMAIL` और `SEED_SUPER_ADMIN_PASSWORD` से login करें।
3. **तुरंत password बदलें** — ऊपर दाएँ avatar → Account (`/center/admin/account`) → Change Password।
4. **Admin → Settings → Branding** में logo, favicon, संस्था का नाम, पता और
   social links upload करें। पूरी साइट की branding यहीं से चलती है।
5. **Admin → Settings → Communication** में SMTP भरें और "Send test email" दबाएँ,
   वरना किसी applicant को confirmation mail नहीं जाएगा।
6. **Admin → Settings → Payments** में gateway चुनें (`manual` या Razorpay)।
7. **Admin → Staff** से Foundation staff के accounts बनाएँ और permissions दें।

---

## 11. Verification checklist

हर line tick होनी चाहिए:

- [ ] `https://eduskillindia.org` — पुरानी साइट पहले जैसी खुल रही है
- [ ] `https://eduskillindia.org/center` — सीधे homepage खुलता है (200, कोई redirect नहीं)
- [ ] `https://eduskillindia.org/center/` — app इसे `/center` पर 308 करता है; यह सामान्य है
- [ ] Page का design/CSS सही दिख रहा है (यानी assets `/center/_next/...` से आ रहे हैं)
- [ ] `https://eduskillindia.org/center/courses` खुलता है, browser back/forward चलता है
- [ ] Login चलता है और refresh करने पर session बना रहता है (loop नहीं बनता)
- [ ] Admin में कोई document/photo upload होकर वापस दिख जाता है
- [ ] Browser का DevTools → Console खाली है (कोई 404 नहीं)
- [ ] `https://eduskillindia.org/center/api/public/stats` — JSON देता है
- [ ] `https://eduskillindia.org/center/sitemap.xml` के अंदर सभी URL में `/center` है
- [ ] मोबाइल पर खोलकर देखें — bottom nav और drawer ठीक चल रहे हैं
- [ ] `sudo systemctl reboot` के बाद भी service अपने आप चालू हुई

Command से जाँच:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://eduskillindia.org/
curl -s -o /dev/null -w '%{http_code}\n' https://eduskillindia.org/center/
curl -s https://eduskillindia.org/center/api/public/stats | head -c 300
```

---

## 12. अगली बार update कैसे करें

एक ही command:

```bash
sudo -u eduskill -H bash -lc 'cd /var/www/center && ./deploy/deploy.sh'
```

(पहली बार `sudo chmod +x /var/www/center/deploy/deploy.sh` चला लें, या
`bash deploy/deploy.sh` लिखें।)

यह script खुद ही: checks → `git pull` → `npm ci` → `prisma generate` →
`npm run db:deploy` → `BASE_PATH` के साथ build → service restart → health check
करता है। हर step चलाने से **पहले** print करता है कि वह क्या करने जा रहा है।

- पहले सिर्फ़ देखना है कि क्या-क्या होगा? → `./deploy/deploy.sh --dry-run`
- Files खुद rsync कर दी हैं? → `./deploy/deploy.sh --no-pull`
- Script root के रूप में चलने से मना कर देता है (यह जानबूझकर है)।

---

## 13. मौजूदा वेबसाइट पर कोई असर नहीं

### जो नया बनेगा (सब अलग-थलग)

| चीज़ | नया value |
|---|---|
| Folder | `/var/www/center` (मौजूदा document root से बाहर) |
| Database | `eduskill_center` (अपना अलग DB) |
| DB user | `eduskill_center` (सिर्फ़ इसी DB तक पहुँच, superuser नहीं) |
| Linux user | `eduskill` (non-root, nologin) |
| Port | `127.0.0.1:3001` (सिर्फ़ localhost पर, इंटरनेट से सीधे नहीं) |
| systemd service | `eduskill-center` |
| Uploads | `/var/www/center/storage` |

### मौजूदा config में सिर्फ़ यह एक बदलाव

- उसी vhost file के अंदर **एक additive block जोड़ा** जाता है (`location /center/ { … }`
  या `ProxyPass /center …`)। कोई मौजूदा line हटाई या बदली नहीं जाती।

### जो बिल्कुल नहीं छुआ जाता

- ✅ मौजूदा वेबसाइट की कोई भी file, theme, plugin या upload
- ✅ मौजूदा database और उसका DB user
- ✅ मौजूदा SSL certificate (वही certificate `/center` पर भी काम करेगा — नया कुछ नहीं चाहिए)
- ✅ DNS records (कोई बदलाव नहीं)
- ✅ मौजूदा PHP / Node / कोई और service
- ✅ Web server का बाकी पूरा config
- ✅ Web server को `restart` नहीं, सिर्फ़ `reload` किया जाता है — एक भी request नहीं गिरती

---

## 14. Rollback — अगर कुछ गड़बड़ हो जाए

`/center` को हटाना बहुत आसान है और उससे पुरानी साइट पर कोई फ़र्क़ नहीं पड़ता:

```bash
# 1. vhost से वह block हटाएँ (या backup file वापस रख दें)
sudo cp /etc/nginx/sites-available/eduskillindia.org.bak.<DATE> \
        /etc/nginx/sites-available/eduskillindia.org

# 2. जाँचें और reload करें
sudo nginx -t && sudo systemctl reload nginx
#    Apache:  sudo apachectl configtest && sudo systemctl reload apache2

# 3. app की service बंद करें
sudo systemctl disable --now eduskill-center
```

इतना करते ही `https://eduskillindia.org/center` 404 देने लगेगा और बाकी साइट पहले जैसी
चलती रहेगी। Folder और database जहाँ हैं वहीं रहेंगे — बाद में फिर से चालू करना हो तो
step 8 और 9 दोहरा दें। (पूरी तरह मिटाना हो तो `deploy/postgres-setup.sql` के आख़िर में
दिए गए DROP commands देखें।)

---

## 15. Troubleshooting

| लक्षण | असली वजह | समाधान |
|---|---|---|
| **502 Bad Gateway** | App चल ही नहीं रहा, या port गलत है | `systemctl status eduskill-center`; `curl -I http://127.0.0.1:3001/center`; `.env` का `PORT` और vhost का `3001` एक जैसा है? |
| **504 Gateway Timeout** | बड़ी report/import में time लग रहा है | vhost में `proxy_read_timeout` बढ़ाएँ (nginx) / `timeout=` बढ़ाएँ (Apache) |
| **`/center/_next/...` पर 404** | Build का `BASE_PATH` और URL मेल नहीं खा रहे | `BASE_PATH="/center"` के साथ दोबारा build: `rm -rf .next && env BASE_PATH=/center npm run build`, फिर service restart |
| **पेज खुलता है पर CSS/JS नहीं आता; assets root से माँगे जा रहे हैं** | पुराना build, जो बिना `BASE_PATH` का बना था | वही — `.next` मिटाकर `BASE_PATH` के साथ दोबारा build |
| **सब कुछ 404, homepage भी** | `proxy_pass` में trailing slash लगा है (`…:3001/`), जिससे `/center` कट जाता है | slash हटाएँ: `proxy_pass http://127.0.0.1:3001;` |
| **`ERR_TOO_MANY_REDIRECTS` सिर्फ़ `/center` पर** | vhost में `/center` → `/center/` का 301/RewriteRule जोड़ा गया है, जो app के `/center/` → `/center` (308) से टकराता है | vhost से वह redirect हटा दें। `deploy/` की दोनों फ़ाइलें पहले से सही हैं: `/center` को redirect नहीं, proxy किया जाता है |
| **Login के बाद फिर login page** (loop) | Cookie का path या `APP_URL` गलत | `.env` में `APP_URL="https://eduskillindia.org/center"` और `BASE_PATH="/center"`; दोबारा build + restart; browser के cookies साफ़ करें |
| **Login पर "Cross-site request blocked"** | Proxy असली `Host` header आगे नहीं भेज रहा | nginx: `proxy_set_header Host $host;` / Apache: `ProxyPreserveHost On` |
| **File upload पर 413 या "Request Entity Too Large"** | Web server की body limit कम है | nginx: `client_max_body_size 25m;` / Apache: `LimitRequestBody 26214400`; फिर reload |
| **Email/certificate में गलत link** | `APP_URL` में `/center` नहीं है | `.env` ठीक करें, service restart; पुराने certificates दोबारा generate करें |
| **Uploads पर "read-only file system"** | systemd `ProtectSystem=strict` में storage path नहीं जोड़ा | unit की `ReadWritePaths=` में सही path डालें, `daemon-reload`, restart |
| **Service start होते ही मर जाती है** | `.env` नहीं मिल रहा, या DB तक पहुँच नहीं | `journalctl -u eduskill-center -n 80 --no-pager`; DB connection अलग से test करें |
| **`.env` का password हाथ से चलाने पर काम करता है, service में नहीं** | Password में `$`, `` ` `` या `#` है — systemd उसे ठीक से नहीं पढ़ता | बिना इन characters वाला password चुनें और DB में बदलें |
| **Build के बीच में disk full** | Next का build cache बड़ा हो गया | `rm -rf /var/www/center/.next` और दोबारा build; `df -h` से जगह देखें |

---

## 16. विकल्प: subdomain (सिर्फ़ जानकारी के लिए)

अगर कभी `/center` के बजाय `center.eduskillindia.org` रखना हो, तो `.env` में `BASE_PATH=""`
(खाली) और `APP_URL="https://center.eduskillindia.org"` करके दोबारा build करना होगा, साथ ही
उस subdomain का अपना DNS record, अपना vhost और अपना SSL certificate चाहिए।

यह सिर्फ़ एक विकल्प है — आपने `/center` चुना है और यह guide उसी के लिए है, जो पूरी तरह
काम करता है और जिसमें नया certificate या DNS बदलाव बिल्कुल नहीं चाहिए।

---

## 17. AI सहायक (चैटबॉट) चालू करना

Public website के नीचे दाईं ओर एक chat button दिखता है — यह **AI सहायक** है। यह हिंदी और
अंग्रेज़ी, दोनों में जवाब देता है और जवाब इसी platform के database से बनाता है: कोर्स, फ़ीस,
ट्रेनिंग सेंटर, admission की प्रक्रिया, scholarship और Foundation के संपर्क विवरण।

यह हिस्सा पूरी तरह **वैकल्पिक** है। बिना key के भी साइट बिल्कुल पहले जैसी चलती है — सहायक
सिर्फ़ खुद को छिपा लेता है, कहीं कोई error या टूटा हुआ button नहीं दिखता।

### 17.1 Key कहाँ डालें

Key उसी production `.env` में जाती है जिसमें बाकी सब है (step 5 वाली file):

```bash
cd /var/www/center
sudo -u eduskill nano .env
```

| Variable | Value |
|---|---|
| `OPENAI_API_KEY` | OpenAI dashboard से बनाई गई key (`sk-…` से शुरू होती है) |

```bash
# बदलने के बाद सिर्फ़ इतना — दोबारा build की ज़रूरत नहीं
sudo systemctl restart eduskill-center
sudo systemctl status eduskill-center --no-pager | head -5
```

> **यह build-time value नहीं है।** `BASE_PATH` के उलट, इसे बदलने पर `npm run build` दोबारा
> चलाने की ज़रूरत नहीं — service restart करते ही नई key लग जाती है।
>
> यह **server-only** secret है। इसे कभी `NEXT_PUBLIC_OPENAI_API_KEY` मत लिखिए, वरना यह
> browser के bundle में चली जाएगी और हर visitor को दिख जाएगी। App में यह key सिर्फ़
> `src/server/chatbot.ts` के अंदर पढ़ी जाती है — किसी response, किसी log line में नहीं जाती।
>
> `.env` की permission 600 ही रहने दें (step 5 में सेट की थी)।

Restart के बाद जाँच:

```bash
curl -s https://eduskillindia.org/center/api/public/chat
```

`"enabled":true` आना चाहिए। `"enabled":false` का मतलब है key नहीं मिली (या admin में switch
बंद है) — और उस हालत में widget दिखता ही नहीं।

### 17.2 Admin से क्या-क्या बदलता है

**Admin → Settings → AI Assistant**
(`https://eduskillindia.org/center/admin/settings/chatbot`). ये सब database में रहते हैं,
इसलिए बदलने पर न build चाहिए, न restart — Save करते ही लागू हो जाते हैं:

| Setting | क्या करता है |
|---|---|
| AI assistant enabled | सहायक चालू/बंद। बंद करते ही widget साइट से हट जाता है |
| OpenAI model | कौन सा model जवाब बनाएगा (default `gpt-4o-mini`) — खर्च मुख्य रूप से इसी से तय होता है |
| Greeting (English) / Greeting (Hindi) | पहला message, जो panel खोलते ही visitor को दिखता है |
| Quick questions | tappable chips। हर line इस रूप में: `English question \| हिंदी प्रश्न` |
| Let visitors hear answers read aloud | जवाब को आवाज़ में सुनने वाला बटन (visitor के अपने device की आवाज़, कोई paid service नहीं) |
| Maximum messages per visitor per hour | एक IP से एक घंटे में अधिकतम कितने message (default 40, सीमा 1–500) |
| Extra instructions for the assistant | सहायक को दी जाने वाली अतिरिक्त हिदायत, जैसे admission की तारीख़ या कोई बात जो हर बार बतानी है |

> Key admin से नहीं बदली जा सकती — यह जानबूझकर है। अगर `.env` में key नहीं है, तो
> "AI assistant enabled" पर tick होने के बावजूद सहायक नहीं दिखेगा।

### 17.3 खर्च कितना आएगा

हर जवाब का बिल OpenAI आपके account पर लगाता है। खर्च तीन बातों पर निर्भर करता है:

- **Input** — हर सवाल के साथ सहायक की instructions + platform का knowledge snapshot (कोर्स,
  सेंटर, फ़ीस वग़ैरह का सारांश, जो 10 मिनट तक cache रहता है) + उसी बातचीत के पिछले message
  भेजे जाते हैं। यानी बातचीत जितनी लंबी चलेगी, उसका हर अगला सवाल उतना ही भारी होगा।
- **Output** — एक जवाब अधिकतम 700 tokens का होता है (यह code में तय है), इसलिए कोई एक जवाब
  बेतहाशा लंबा और महँगा नहीं हो सकता।
- **Model** — default `gpt-4o-mini` सबसे सस्ते विकल्पों में है। `gpt-4o` जैसे बड़े model का
  per-token rate कई गुना ज़्यादा होता है, यानी सिर्फ़ model बदल देने से बिल कई गुना हो सकता है।

per-token rate OpenAI समय-समय पर बदलता रहता है, इसलिए यह guide कोई आँकड़ा नहीं देती — असली
rate <https://openai.com/api/pricing> पर देखें और पहले महीने OpenAI dashboard → Usage पर नज़र
रखें। सबसे पक्की सुरक्षा यह है कि OpenAI account में ही **monthly budget limit** लगा दें।

**Abuse की सीमा:** हर message भेजने से *पहले* उस visitor के IP की hourly limit जाँची जाती है।
Limit पार होते ही server सीधे **429** लौटा देता है और OpenAI को कुछ भेजा ही नहीं जाता — उस
request का खर्च शून्य। इसका मतलब है कि एक घंटे में किसी एक IP से उतने ही message जा सकते हैं
जितने आपने सेट किए हैं। Limit कम रखेंगे तो खर्च की छत नीची रहेगी, पर एक ही office या college
के NAT IP से आने वाले सच्चे visitor भी जल्दी रुक सकते हैं।

### 17.4 Troubleshooting

| लक्षण | असली वजह | समाधान |
|---|---|---|
| **Widget दिखता ही नहीं** | `.env` में `OPENAI_API_KEY` खाली है, restart नहीं हुआ, या admin में switch बंद है | `curl -s https://eduskillindia.org/center/api/public/chat` — `"enabled":false` आए तो key भरें, `sudo systemctl restart eduskill-center`, फिर Admin → Settings → AI Assistant में tick जाँचें |
| **Widget है, पर हर सवाल पर "कुछ गड़बड़ हो गई"** | Key गलत या रद्द है, account में credit नहीं है, या settings में लिखा model उस account को नहीं मिलता | `journalctl -u eduskill-center -n 50 --no-pager`; OpenAI dashboard में key और billing देखें; model वापस `gpt-4o-mini` कर दें |
| **"बहुत ज़्यादा message" / 429** | उस IP की hourly limit पूरी हो गई (एक ही NAT IP से कई लोग हों तो जल्दी होता है) | एक घंटे बाद अपने आप खुल जाता है। बार-बार हो तो Admin → Settings → AI Assistant में "Maximum messages per visitor per hour" बढ़ाएँ |
| **जवाब टाइप होते हुए नहीं आते, एक साथ आख़िर में आते हैं** | Proxy streaming response को buffer कर रहा है | App खुद `X-Accel-Buffering: no` भेजता है; nginx block में `proxy_buffering off;` होना चाहिए (`deploy/nginx-center.conf` में पहले से है — अपना block हाथ से लिखा हो तो जोड़ें) |
| **iPhone या Firefox पर माइक/आवाज़ का बटन नहीं दिखता** | ये feature browser के अपने Web Speech API से चलते हैं। Firefox और अधिकांश iOS browsers में voice input है ही नहीं, इसलिए बटन जानबूझकर नहीं दिखाया जाता | यह bug नहीं है। Android Chrome और desktop Chrome/Edge में दोनों चलते हैं; बाकी जगह visitor type करके पूछ सकता है |
| **हिंदी जवाब अजीब उच्चारण में पढ़ा जाता है** | Device में हिंदी voice installed नहीं है | Android: Settings → Text-to-speech → हिंदी voice download करें। वरना engine अंग्रेज़ी voice से पढ़ देगा |

---

## फ़ाइलें जो इस deployment के लिए बनी हैं

| File | किसलिए |
|---|---|
| `deploy/nginx-center.conf` | nginx में जोड़ने वाला block |
| `deploy/apache-center.conf` | Apache में जोड़ने वाला block |
| `deploy/eduskill-center.service` | systemd service (सुझाया गया तरीका) |
| `deploy/ecosystem.config.cjs` | PM2 विकल्प (systemd का alternative, दोनों नहीं) |
| `deploy/.env.production.example` | production `.env` का template |
| `deploy/postgres-setup.sql` | अलग database + DB user बनाने के लिए |
| `deploy/deploy.sh` | हर बार update करने की script |
