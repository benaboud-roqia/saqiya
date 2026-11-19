# Sāqiya — met TOUT le système en ligne gratuitement depuis ce PC (tunnel Cloudflare).
#  1. lance le serveur s'il ne tourne pas déjà ;
#  2. ouvre un tunnel https (adresse *.trycloudflare.com, nouvelle à chaque démarrage) ;
#  3. met à jour la page GitHub https://benaboud-roqia.github.io/saqiya/ pour que ses boutons mènent à cette adresse ;
#  4. ouvre le système dans le navigateur.
# Le boîtier ESP32 branché en USB continue de fonctionner : le serveur reste sur ce PC.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Cf = Join-Path $Root "outils\cloudflared.exe"
$Data = Join-Path $Root "data"
$Log = Join-Path $Data "tunnel.log"
$AddrFile = Join-Path $Data "adresse_en_ligne.txt"
$Repo = "https://github.com/benaboud-roqia/saqiya.git"

function Write-Step($t) { Write-Host "`n>> $t" -ForegroundColor Cyan }

if (-not (Test-Path $Cf)) {
    Write-Host "cloudflared.exe introuvable dans outils\ : téléchargez-le depuis github.com/cloudflare/cloudflared/releases (cloudflared-windows-amd64.exe) et renommez-le cloudflared.exe." -ForegroundColor Red
    exit 1
}

# 1. serveur
Write-Step "Serveur Sāqiya"
$listening = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($listening) {
    Write-Host "Le serveur tourne déjà sur le port 8000."
} else {
    Start-Process -FilePath "python" -ArgumentList "backend\server.py" -WorkingDirectory $Root -WindowStyle Minimized
    for ($i = 0; $i -lt 30 -and -not (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue); $i++) { Start-Sleep 1 }
    Write-Host "Serveur démarré (fenêtre réduite dans la barre des tâches)."
}

# 2. tunnel (un seul à la fois)
Write-Step "Tunnel Cloudflare"
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
if (Test-Path $Log) { Remove-Item $Log -Force }
Start-Process -FilePath $Cf -ArgumentList "tunnel --no-autoupdate --url http://localhost:8000 --logfile `"$Log`"" -WindowStyle Hidden
$url = $null
for ($i = 0; $i -lt 60 -and -not $url; $i++) {
    Start-Sleep 1
    if (Test-Path $Log) {
        $m = Select-String -Path $Log -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($m) { $url = $m.Matches[0].Value }
    }
}
if (-not $url) { Write-Host "Le tunnel n'a pas donné d'adresse (vérifiez la connexion Internet), voir $Log" -ForegroundColor Red; exit 1 }
Set-Content -Path $AddrFile -Value $url -Encoding ASCII
Write-Host "Adresse en ligne : $url" -ForegroundColor Green

# 3. page GitHub : les boutons « Ouvrir le tableau de bord » mènent à la nouvelle adresse
Write-Step "Mise à jour de la page GitHub"
try {
    $tmp = Join-Path $env:TEMP "saqiya_ghpages"
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    New-Item -ItemType Directory $tmp | Out-Null
    Copy-Item (Join-Path $Root "site\*") $tmp -Recurse
    $cfg = "/* site publié sur GitHub Pages : adresse du tableau de bord mise à jour par en_ligne.ps1 */`nwindow.SAQIYA = { app: `"$url/app/`", addr: `"https://raw.githubusercontent.com/benaboud-roqia/saqiya/gh-pages/adresse.json`", live: false, embed: false };`n"
    [IO.File]::WriteAllText((Join-Path $tmp "config.js"), $cfg, (New-Object Text.UTF8Encoding $false))
    # adresse.json : lu par le site Vercel pour trouver le tableau de bord sans republier le site
    $stamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    [IO.File]::WriteAllText((Join-Path $tmp "adresse.json"), "{`"url`": `"$url`", `"maj`": `"$stamp`"}`n", (New-Object Text.UTF8Encoding $false))
    New-Item -ItemType File (Join-Path $tmp ".nojekyll") | Out-Null
    $name = git -C $Root config user.name; $mail = git -C $Root config user.email
    Push-Location $tmp
    $ErrorActionPreference = "Continue"            # les messages d'information de git ne sont pas des erreurs
    $g = @("-c", "core.autocrlf=false", "-c", "user.name=$name", "-c", "user.email=$mail")
    git init -q -b gh-pages 2>&1 | Out-Null
    git @g add -A 2>&1 | Out-Null
    git @g commit -q -m "Site vitrine : tableau de bord en ligne sur $url" 2>&1 | Out-Null
    git @g -c credential.helper= -c "credential.helper=!gh auth git-credential" push -q -f $Repo gh-pages 2>&1 | Out-Null
    $code = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    Pop-Location
    if ($code -ne 0) { throw "l'envoi vers GitHub a échoué (compte GitHub connecté sur ce PC ?)" }
    Write-Host "Page mise à jour : https://benaboud-roqia.github.io/saqiya/ (visible d'ici 1 à 2 minutes)."
} catch {
    Pop-Location -ErrorAction SilentlyContinue
    Write-Host "Page GitHub non mise à jour ($($_.Exception.Message)). Le système reste accessible à l'adresse ci-dessus." -ForegroundColor Yellow
}

# 4. ouverture
Write-Step "C'est en ligne"
Write-Host "Tableau de bord : $url/app/" -ForegroundColor Green
Write-Host "Laissez ce PC allumé et cette fenêtre ouverte. Fermer la fenêtre n'arrête pas le tunnel : pour l'arrêter, relancez ce script ou redémarrez le PC."
Start-Process "$url/app/"
