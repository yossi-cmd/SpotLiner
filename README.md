# ספוטליינר (Spotliner)

אפליקציית מוזיקה שיתופית בסגנון Spotify. מנהלים או משתמשים עם הרשאת העלאה יכולים להעלות שירים, וכל המשתמשים יכולים להאזין, ליצור פלייליסטים, לאהב שירים ולהוסיף לתור.

## דרישות

- Node.js 18+
- חשבון חינמי ב־[Neon.tech](https://neon.tech) (PostgreSQL בענן)

## התקנה

### 1. התקנת תלויות

```bash
cd /Users/yossibiton/Projects/spotify
npm install
cd client && npm install
cd ../server && npm install
```

### 2. מסד נתונים ב־Neon.tech

1. היכנס ל־**https://neon.tech** והתחבר (GitHub וכו').
2. **Create a project** – בחר שם ו־region (למשל EU Central).
3. אחרי יצירת הפרויקט, בדשבורד יופיע **Connection string** – העתק את ה־URL המלא (למשל `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`).
4. צור קובץ סביבה:
   ```bash
   cp server/.env.example server/.env
   ```
5. פתח `server/.env` והדבק את ה־URL ב־`DATABASE_URL`:
   ```
   DATABASE_URL=postgresql://...המחרוזת שהעתקת...
   ```
6. הרץ את הסכמה (פעם אחת) מתוך תיקיית הפרויקט:
   ```bash
   cd server && node db/migrate.js
   ```
   אמור להופיע: `Schema applied successfully.`

   **אם המסד כבר קיים:**  
   - ללא טבלאות אומנים/אלבומים: הרץ `server/db/migration-artists-albums.sql` ב־Neon SQL Editor.  
   - להרשאות עריכה (יוצר/מנהל): הרץ `server/db/migration-created-by.sql` ב־Neon SQL Editor.

### 3. שאר משתני הסביבה

ערוך `server/.env` והוסף/עדכן:

- `JWT_SECRET=מחרוזת-סודית-חזקה-אקראית`
- `PORT=3001`
- `UPLOAD_PATH=./uploads/audio`
- `CLIENT_URL=http://localhost:5173`

**לקוח (client):**

אם ה-API רץ על פורט/דומיין אחר:

```bash
# client/.env
VITE_API_URL=http://localhost:3001
```

אם משתמשים ב-proxy של Vite (ברירת מחדל), אין חובה להגדיר.

### 4. יצירת משתמש מנהל

אחרי הרשמה ראשונה באתר, הפוך את המשתמש למנהל (כדי לאפשר העלאת שירים):

- היכנס ל־Neon → הפרויקט → **SQL Editor**, והרץ:

```sql
UPDATE users SET role = 'admin' WHERE email = 'האימייל-שלך@example.com';
```

### 5. הרצה

**פיתוח (שרת + לקוח):**

```bash
npm run dev
```

או בנפרד:

```bash
# טרמינל 1
cd server && npm run dev

# טרמינל 2
cd client && npm run dev
```

- פרונט: http://localhost:5173  
- API: http://localhost:3001  

**Production:**

```bash
cd client && npm run build
cd ../server && npm start
```

הגש את תוכן `client/dist` דרך שרת סטטי או הפעל שרת שמגיש אותו (למשל מהתיקייה `server`).

## תכונות

- **אימות:** הרשמה והתחברות (JWT), תפקידים: user, uploader, admin
- **שירים:** העלאה (admin/uploader), רשימה, חיפוש, סטרימינג עם תמיכה ב-seek
- **פלייליסטים:** יצירה, עריכה, הוספת/הסרת שירים
- **אהובים והיסטוריה:** שמירת שירים אהובים והשמעה לאחרונה
- **תור השמעה:** הוספה לתור, הבא/הקודם, נגן תחתון בסגנון Spotify

## מבנה

- `client/` – React (Vite), Zustand, React Router
- `server/` – Express, PostgreSQL, JWT, Multer (העלאות), סטרימינג אודיו
