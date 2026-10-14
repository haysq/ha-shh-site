<?php
/**
 * Cookieless visit counter for ha-shh.com. No IP, cookie or device id is stored; only daily totals.
 * Data lives OUTSIDE the web root (../istatistik.json) and is read by the UĞRAŞ admin panel (İstatistik › ha!shh).
 */
declare(strict_types=1);
date_default_timezone_set('Europe/Istanbul');
header('X-Robots-Tag: noindex');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }
// Only requests from this site itself
$kaynak = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
$kh = strtolower((string)parse_url($kaynak, PHP_URL_HOST));
if ($kh !== 'ha-shh.com') { http_response_code(204); exit; }
// Bots, link previews, speed tests and automation are not counted
$ua = strtolower($_SERVER['HTTP_USER_AGENT'] ?? '');
if ($ua === '' || preg_match('/bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|python|google|inspection|externalhit|externalagent|facebookcatalog|whatsapp\/|telegram|skype|slack|discord|yandex|bing|semrush|ahrefs|gtmetrix|pingdom|uptime|hostinger|pagespeed|phantom|selenium|puppeteer|playwright/', $ua)) { http_response_code(204); exit; }

$g = json_decode((string)file_get_contents('php://input', false, null, 0, 2048), true);
if (!is_array($g)) { http_response_code(204); exit; }
$tur = (string)($g['t'] ?? '');
if (!in_array($tur, ['sayfa', 'posta'], true)) { http_response_code(204); exit; }
$yol = substr(preg_replace('~[^a-z0-9/_-]~', '', strtolower((string)($g['p'] ?? '/'))), 0, 80) ?: '/';
// Referrer: host name only
$ref = substr(preg_replace('~[^a-z0-9.-]~', '', strtolower((string)($g['r'] ?? ''))), 0, 60);
$kanal = match (true) {
  $ref === '' => 'doğrudan',
  str_contains($ref, 'google.') => 'google',
  str_contains($ref, 'bing.') => 'bing',
  str_contains($ref, 'yandex.') => 'yandex',
  str_contains($ref, 'duckduckgo.') => 'duckduckgo',
  str_contains($ref, 'reddit.') => 'reddit',
  str_contains($ref, 'instagram.') => 'instagram',
  str_contains($ref, 'facebook.') || $ref === 'fb.com' || str_starts_with($ref, 'l.fb') => 'facebook',
  $ref === 't.co' || str_contains($ref, 'x.com') || str_contains($ref, 'twitter.') => 'x (twitter)',
  str_contains($ref, 'github.') => 'github',
  default => $ref,
};

$dosya = dirname(__DIR__) . '/istatistik.json';
$fp = fopen($dosya, 'c+');
if (!$fp) { http_response_code(204); exit; }
flock($fp, LOCK_EX);
$veri = json_decode(stream_get_contents($fp) ?: '{}', true) ?: [];
$gun = date('Y-m-d');
$d = ($veri[$gun] ?? []) + ['ziyaret' => 0, 'tekil' => 0, 'yeni' => 0, 'sayfa' => 0, 'posta' => 0, 'sayfalar' => [], 'kanallar' => []];
if ($tur === 'sayfa') {
  $d['sayfa']++;
  if (count($d['sayfalar']) < 200 || isset($d['sayfalar'][$yol])) $d['sayfalar'][$yol] = ($d['sayfalar'][$yol] ?? 0) + 1;
  if (!empty($g['y']) && (count($d['kanallar']) < 50 || isset($d['kanallar'][$kanal]))) { $d['ziyaret']++; $d['kanallar'][$kanal] = ($d['kanallar'][$kanal] ?? 0) + 1; }
  elseif (!empty($g['y'])) $d['ziyaret']++;
  if (!empty($g['g'])) $d['tekil']++;   // same browser, once a day
  if (!empty($g['n'])) $d['yeni']++;    // first visit ever
} else {
  $d[$tur]++;
}
$veri[$gun] = $d;
// Keep the last 400 days
if (count($veri) > 400) { ksort($veri); $veri = array_slice($veri, -400, null, true); }
ftruncate($fp, 0); rewind($fp);
fwrite($fp, json_encode($veri, JSON_UNESCAPED_UNICODE));
fflush($fp); flock($fp, LOCK_UN); fclose($fp);
http_response_code(204);
