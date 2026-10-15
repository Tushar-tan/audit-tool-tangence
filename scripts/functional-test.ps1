$auditId = '4dc8595d-1aae-4f8b-81aa-50179abdf16e'
$base = 'http://localhost:3000'
$pass = 0
$fail = 0

function Test-Endpoint {
    param($label, $url, $expectedStatus = 200)
    try {
        $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 20 -ErrorAction Stop
        if ($r.StatusCode -eq $expectedStatus) {
            Write-Host ("  OK  " + $label + " [HTTP " + $r.StatusCode + "] (" + [math]::Round($r.RawContentLength/1024,1) + " KB)") -ForegroundColor Green
            return $r
        } else {
            Write-Host ("  FAIL " + $label + " [HTTP " + $r.StatusCode + "]") -ForegroundColor Red
            return $null
        }
    } catch {
        Write-Host ("  FAIL " + $label + " - Error: " + $_.Exception.Message) -ForegroundColor Red
        return $null
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  AUDIT PLATFORM FULL FUNCTIONAL TESTS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "--- UI Pages ---" -ForegroundColor Yellow
$r = Test-Endpoint "Homepage              /                     " "$base/"
if ($r) { $pass++ } else { $fail++ }

$r = Test-Endpoint "Audit History         /audits/history       " "$base/audits/history"
if ($r) { $pass++ } else { $fail++ }

$r = Test-Endpoint "New Audit Form        /audits/new           " "$base/audits/new"
if ($r) { $pass++ } else { $fail++ }

$r = Test-Endpoint "Audit Detail Page     /audits/{id}          " "$base/audits/$auditId"
if ($r) { $pass++ } else { $fail++ }

$r = Test-Endpoint "Compare Page          /compare              " "$base/compare"
if ($r) { $pass++ } else { $fail++ }

$r = Test-Endpoint "Settings Page         /settings             " "$base/settings"
if ($r) { $pass++ } else { $fail++ }

Write-Host ""
Write-Host "--- REST API Endpoints ---" -ForegroundColor Yellow

$r = Test-Endpoint "GET /api/audits                            " "$base/api/audits"
if ($r) {
    $audits = $r.Content | ConvertFrom-Json
    Write-Host "       -> $($audits.Count) audit(s) in database" -ForegroundColor DarkGray
    $pass++
} else { $fail++ }

$r = Test-Endpoint "GET /api/audits/{id}                       " "$base/api/audits/$auditId"
if ($r) {
    $audit = $r.Content | ConvertFrom-Json
    Write-Host "       -> Score: $($audit.overallScore)/100 | Issues: $($audit.issues.Count) | Pages: $($audit.totalPages) | Status: $($audit.status)" -ForegroundColor DarkGray
    $pass++
} else { $fail++ }

Write-Host ""
Write-Host "--- Report Export Formats ---" -ForegroundColor Yellow

$exportUrl = "$base/api/export?auditId=$auditId"

$r = Test-Endpoint "Export HTML                                " ($exportUrl + "&format=html")
if ($r) {
    $hasPageHeaders = $r.Content -match 'class="page-header"'
    Write-Host "       -> Page-wise grouping: $(if ($hasPageHeaders) {'YES'} else {'NO'})" -ForegroundColor DarkGray
    $pass++
} else { $fail++ }

$r = Test-Endpoint "Export Markdown                            " ($exportUrl + "&format=markdown")
if ($r) {
    $hasPageHeaders = $r.Content -match 'Page URL:'
    Write-Host "       -> Page-wise grouping: $(if ($hasPageHeaders) {'YES'} else {'NO'})" -ForegroundColor DarkGray
    $pass++
} else { $fail++ }

$r = Test-Endpoint "Export CSV                                 " ($exportUrl + "&format=csv")
if ($r) {
    $lines = ($r.Content -split "`n").Count - 1
    $hasPageCol = $r.Content -match '^"Page URL"'
    Write-Host "       -> $lines issue row(s), Page URL column: $(if ($hasPageCol) {'YES'} else {'NO'})" -ForegroundColor DarkGray
    $pass++
} else { $fail++ }

$r = Test-Endpoint "Export JSON                                " ($exportUrl + "&format=json")
if ($r) {
    $json = $r.Content | ConvertFrom-Json
    Write-Host "       -> $($json.issues.Count) issues, $($json.issuesByPage.Count) page group(s)" -ForegroundColor DarkGray
    $pass++
} else { $fail++ }

$r = Test-Endpoint "Export DOCX                                " ($exportUrl + "&format=docx")
if ($r) { $pass++ } else { $fail++ }

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  RESULTS: $pass Passed / $fail Failed" -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Red' })
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
