# Sāqiya — met TOUT le système en ligne gratuitement depuis ce PC (tunnel Cloudflare).
#  1. lance le serveur s'il ne tourne pas déjà ;
#  2. ouvre un tunnel https (adresse *.trycloudflare.com, nouvelle à chaque démarrage) ;
#  3. publie cette adresse sur GitHub (page GitHub + adresse.json lu par le site Vercel) ;
#  4. ouvre le système dans le navigateur, puis SURVEILLE : si le serveur ou le tunnel s'arrête,
#     il est relancé tout seul (et la nouvelle adresse est republiée).
# Le boîtier ESP32 branché en USB continue de fonctionner : le serveur reste sur ce PC.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Cf = Join-Path $Root "outils\cloudflared.exe"
$Data = Join-Path $Root "data"
$Log = Join-Path $Data "tunnel.log"
$AddrFile = Join-Path $Data "adresse_en_ligne.txt"
$ServerLog = Join-Path $Data "serveur.log"
$Repo = "https://github.com/benaboud-roqia/saqiya.git"

function Write-Step($t) { Write-Host "`n>> $t" -ForegroundColor Cyan }
function Test-Server { [bool](Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) }

if (-not (Test-Path $Cf)) {
    Write-Host "cloudflared.exe introuvable dans outils\ : téléchargez-le depuis github.com/cloudflare/cloudflared/releases (cloudflared-windows-amd64.exe) et renommez-le cloudflared.exe." -ForegroundColor Red
    exit 1
}

function Start-Server {
    if (Test-Server) { return }
    # fenêtre cachée : on ne peut plus la fermer par erreur ; les messages vont dans data\serveur.log
    Start-Process -FilePath "python" -ArgumentList "backend\server.py" -WorkingDirectory $Root -WindowStyle Hidden `
        -RedirectStandardOutput $ServerLog -RedirectStandardError "$ServerLog.err"
    for ($i = 0; $i -lt 30 -and -not (Test-Server); $i++) { Start-Sleep 1 }
    if (Test-Server) { Write-Host "Serveur démarré." -ForegroundColor Green }
    else { Write-Host "Le serveur ne démarre pas : voir $ServerLog.err" -ForegroundColor Red }
}

function Publish-Address($url) {
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
        Write-Host "Adresse publiée : page GitHub et site Vercel à jour d'ici 1 à 5 minutes."
    } catch {
        Pop-Location -ErrorAction SilentlyContinue
        $ErrorActionPreference = "Stop"
        Write-Host "Adresse non publiée sur GitHub ($($_.Exception.Message)). Le système reste accessible à l'adresse ci-dessus." -ForegroundColor Yellow
    }
}

function Start-Tunnel {
    Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
    if (Test-Path $Log) { Remove-Item $Log -Force }
    $p = Start-Process -FilePath $Cf -ArgumentList "tunnel --no-autoupdate --url http://localhost:8000 --logfile `"$Log`"" -WindowStyle Hidden -PassThru
    $url = $null
    for ($i = 0; $i -lt 60 -and -not $url; $i++) {
        Start-Sleep 1
        if (Test-Path $Log) {
            $m = Select-String -Path $Log -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($m) { $url = $m.Matches[0].Value }
        }
    }
    if (-not $url) { Write-Host "Le tunnel n'a pas donné d'adresse (connexion Internet ?), voir $Log" -ForegroundColor Red; return $null }
    Set-Content -Path $AddrFile -Value $url -Encoding ASCII
    Write-Host "Adresse en ligne : $url" -ForegroundColor Green
    Publish-Address $url
    return @{ url = $url; proc = $p }
}

# 1. serveur
Write-Step "Serveur Sāqiya"
Start-Server

# 2-3. tunnel + publication
Write-Step "Tunnel Cloudflare"
$t = Start-Tunnel
if (-not $t) { exit 1 }

# 4. ouverture
Write-Step "C'est en ligne"
Write-Host "Tableau de bord : $($t.url)/app/" -ForegroundColor Green
Start-Process "$($t.url)/app/"
Write-Host "`nLaissez ce PC allumé et CETTE FENÊTRE OUVERTE : elle surveille le système et le relance tout seul en cas de panne." -ForegroundColor Yellow

# surveillance : toutes les 20 s
$fails = 0
while ($true) {
    Start-Sleep 20
    if (-not (Test-Server)) {
        Write-Host "$(Get-Date -Format HH:mm:ss) Serveur arrêté : redémarrage..." -ForegroundColor Yellow
        Start-Server
    }
    $alive = $false
    if (-not $t.proc.HasExited) {
        try { $alive = (Invoke-WebRequest "$($t.url)/api/alive" -UseBasicParsing -TimeoutSec 15).StatusCode -eq 200 } catch { $alive = $false }
    }
    if ($alive) { $fails = 0; continue }
    $fails++
    if ($t.proc.HasExited -or $fails -ge 3) {          # tunnel mort, ou injoignable 3 fois de suite (~1 min)
        Write-Host "$(Get-Date -Format HH:mm:ss) Tunnel coupé : nouvelle adresse..." -ForegroundColor Yellow
        $n = Start-Tunnel
        if ($n) { $t = $n; $fails = 0 }
    }
}
