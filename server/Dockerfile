FROM node:20-bookworm

# התקנת yt-dlp ו-ffmpeg (למיקסוד אודיו)
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates ffmpeg && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# העתקת קבצי ה- package.json של השרת והתקנת תלויות
COPY package*.json ./
RUN npm install --only=production

# העתקת שאר קבצי השרת
COPY . .

# Railway נותן PORT, אבל נגדיר ברירת מחדל
ENV PORT=3000

# הפעלת השרת
CMD ["npm", "start"]