cd "C:\Users\Anonimous\PULSE-PLAY-CLONE"

git add .
$changes = git status --porcelain

if ($changes) {
    git commit -m "auto: update project changes"
    git push origin main
}