<?php

declare(strict_types=1);

error_reporting(0);
ini_set('display_errors', '0');

// The rate-limit secret is created on the server on first use and kept outside the web root (never in the repo).
function rate_secret(string $dir): string {
    $f = $dir . '/_secret';
    if (!is_file($f)) {
        @file_put_contents($f, bin2hex(random_bytes(32)), LOCK_EX);
        @chmod($f, 0600);
    }
    $v = @file_get_contents($f);
    return ($v !== false && strlen($v) >= 32) ? $v : 'fallback-' . __FILE__;
}

function json_response(int $status, array $data): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function clean_string(string $str, int $maxLength): string
{
    $cleaned = preg_replace('/(?![\n])\p{Cc}/u', '', $str);
    if ($cleaned === null) {
        $cleaned = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]/', '', $str) ?? '';
    }
    return mb_substr(trim($cleaned), 0, $maxLength, 'UTF-8');
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        json_response(405, ['ok' => false, 'error' => 'Method Not Allowed']);
    }

    $contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
    $mime = strtolower(trim(explode(';', $contentType)[0]));
    if ($mime !== 'application/json') {
        json_response(415, ['ok' => false, 'error' => 'Unsupported Media Type']);
    }

    if (isset($_SERVER['HTTP_ORIGIN'])) {
        $origin = $_SERVER['HTTP_ORIGIN'];
        if ($origin !== 'https://ha-shh.com' && $origin !== 'http://127.0.0.1:8766') {
            json_response(403, ['ok' => false, 'error' => 'Forbidden']);
        }
    }

    if (isset($_SERVER['CONTENT_LENGTH']) && (int)$_SERVER['CONTENT_LENGTH'] > 32768) {
        json_response(413, ['ok' => false, 'error' => 'Payload Too Large']);
    }

    $rawInput = file_get_contents('php://input', false, null, 0, 32769);
    if ($rawInput === false || strlen($rawInput) > 32768) {
        json_response(413, ['ok' => false, 'error' => 'Payload Too Large']);
    }

    if ($rawInput === '') {
        json_response(400, ['ok' => false, 'error' => 'Empty request body']);
    }

    try {
        $data = json_decode($rawInput, true, 512, JSON_THROW_ON_ERROR);
    } catch (\JsonException) {
        json_response(400, ['ok' => false, 'error' => 'Invalid JSON']);
    }

    if (!is_array($data)) {
        json_response(400, ['ok' => false, 'error' => 'Invalid JSON structure']);
    }

    if (isset($data['hp']) && $data['hp'] !== '' && $data['hp'] !== null) {
        json_response(200, ['ok' => true]);
    }

    if (!array_key_exists('consent', $data) || $data['consent'] !== true) {
        json_response(400, ['ok' => false, 'error' => 'Consent is required']);
    }

    $allowedLangs = ['en', 'tr', 'ar', 'de', 'es', 'fr', 'hi', 'id', 'pt', 'ru'];
    if (!isset($data['lang']) || !is_string($data['lang']) || !in_array($data['lang'], $allowedLangs, true)) {
        json_response(400, ['ok' => false, 'error' => 'Invalid lang']);
    }
    $cleanLang = $data['lang'];

    if (!isset($data['page']) || !is_string($data['page'])) {
        json_response(400, ['ok' => false, 'error' => 'Invalid page']);
    }
    $cleanPage = clean_string($data['page'], 200);
    if (!str_starts_with($cleanPage, '/')) {
        json_response(400, ['ok' => false, 'error' => 'Page must start with /']);
    }

    if (!isset($data['msgs']) || !is_array($data['msgs']) || count($data['msgs']) > 60) {
        json_response(400, ['ok' => false, 'error' => 'Invalid msgs']);
    }

    $cleanMsgs = [];
    foreach ($data['msgs'] as $msg) {
        if (!is_array($msg) || !isset($msg['who'], $msg['text']) || !is_string($msg['who']) || !is_string($msg['text'])) {
            json_response(400, ['ok' => false, 'error' => 'Invalid message format']);
        }
        if ($msg['who'] !== 'me' && $msg['who'] !== 'bot') {
            json_response(400, ['ok' => false, 'error' => 'Invalid message sender']);
        }
        $cleanMsgs[] = [
            'who' => $msg['who'],
            'text' => clean_string($msg['text'], 2000),
        ];
    }

    $cleanNote = '';
    if (array_key_exists('note', $data) && $data['note'] !== null) {
        if (!is_string($data['note'])) {
            json_response(400, ['ok' => false, 'error' => 'Invalid note']);
        }
        $cleanNote = clean_string($data['note'], 1000);
    }

    $storageDir = dirname(__DIR__) . '/feedback';
    if (!is_dir($storageDir)) {
        if (!mkdir($storageDir, 0700, true) && !is_dir($storageDir)) {
            json_response(500, ['ok' => false]);
        }
    }

    $htaccessPath = $storageDir . '/.htaccess';
    if (!file_exists($htaccessPath)) {
        file_put_contents($htaccessPath, "Require all denied\n", LOCK_EX);
        @chmod($htaccessPath, 0600);
    }

    $remoteIp = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    $ipHash = hash_hmac('sha256', $remoteIp, rate_secret($storageDir));
    $rateFile = $storageDir . '/_rate.json';

    $rateFp = fopen($rateFile, 'c+');
    if (!$rateFp) {
        json_response(500, ['ok' => false]);
    }
    @chmod($rateFile, 0600);

    if (!flock($rateFp, LOCK_EX)) {
        fclose($rateFp);
        json_response(500, ['ok' => false]);
    }

    $rateContent = stream_get_contents($rateFp);
    $rateMap = [];
    if (!empty($rateContent)) {
        $decodedRates = json_decode($rateContent, true);
        if (is_array($decodedRates)) {
            $rateMap = $decodedRates;
        }
    }

    $now = time();
    $cutoffHour = $now - 3600;
    $prunedRates = [];

    foreach ($rateMap as $hash => $timestamps) {
        if (is_array($timestamps)) {
            $valid = array_values(array_filter($timestamps, function ($ts) use ($cutoffHour) {
                return is_int($ts) && $ts > $cutoffHour;
            }));
            if (!empty($valid)) {
                $prunedRates[$hash] = $valid;
            }
        }
    }

    $currentEntries = $prunedRates[$ipHash] ?? [];
    if (count($currentEntries) >= 5) {
        ftruncate($rateFp, 0);
        rewind($rateFp);
        fwrite($rateFp, json_encode($prunedRates, JSON_UNESCAPED_SLASHES));
        fflush($rateFp);
        flock($rateFp, LOCK_UN);
        fclose($rateFp);
        json_response(429, ['ok' => false, 'error' => 'Too Many Requests']);
    }

    $currentEntries[] = $now;
    $prunedRates[$ipHash] = $currentEntries;

    ftruncate($rateFp, 0);
    rewind($rateFp);
    fwrite($rateFp, json_encode($prunedRates, JSON_UNESCAPED_SLASHES));
    fflush($rateFp);
    flock($rateFp, LOCK_UN);
    fclose($rateFp);

    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $uaFamily = (stripos($ua, 'Mobi') !== false) ? 'mobile' : 'desktop';

    $submission = [
        'received' => gmdate('Y-m-d\TH:i:s\Z'),
        'lang' => $cleanLang,
        'page' => $cleanPage,
        'note' => $cleanNote,
        'msgs' => $cleanMsgs,
        'ua_family' => $uaFamily,
    ];

    $todayDir = $storageDir . '/' . gmdate('Y-m-d');
    if (!is_dir($todayDir)) {
        if (!mkdir($todayDir, 0700, true) && !is_dir($todayDir)) {
            json_response(500, ['ok' => false]);
        }
    }

    $filePath = $todayDir . '/' . bin2hex(random_bytes(8)) . '.json';
    $encodedData = json_encode(
        $submission,
        JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );

    if ($encodedData === false || file_put_contents($filePath, $encodedData . "\n", LOCK_EX) === false) {
        json_response(500, ['ok' => false]);
    }
    chmod($filePath, 0600);

    $retentionCutoff = gmdate('Y-m-d', $now - (365 * 86400));
    $storageEntries = scandir($storageDir);
    if ($storageEntries !== false) {
        foreach ($storageEntries as $entry) {
            if ($entry === '.' || $entry === '..' || $entry === '_rate.json' || $entry === '.htaccess') {
                continue;
            }
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $entry) && $entry < $retentionCutoff) {
                $oldDir = $storageDir . '/' . $entry;
                if (is_dir($oldDir)) {
                    $dayFiles = scandir($oldDir);
                    if ($dayFiles !== false) {
                        foreach ($dayFiles as $file) {
                            if ($file !== '.' && $file !== '..') {
                                @unlink($oldDir . '/' . $file);
                            }
                        }
                    }
                    @rmdir($oldDir);
                }
            }
        }
    }

    json_response(200, ['ok' => true]);
} catch (\Throwable) {
    json_response(500, ['ok' => false]);
}

