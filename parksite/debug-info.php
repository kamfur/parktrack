<?php
// ===== PLIK DEBUGOWANIA =====
session_start();

echo "<h1>🐛 INFORMACJE DEBUGOWANIA</h1>";

echo "<h2>📊 Informacje PHP:</h2>";
echo "<pre>";
echo "PHP Version: " . phpversion() . "\n";
echo "Server Software: " . ($_SERVER['SERVER_SOFTWARE'] ?? 'BRAK') . "\n";
echo "Document Root: " . ($_SERVER['DOCUMENT_ROOT'] ?? 'BRAK') . "\n";
echo "Script Name: " . ($_SERVER['SCRIPT_NAME'] ?? 'BRAK') . "\n";
echo "</pre>";

echo "<h2>🍪 Sesja:</h2>";
echo "<pre>";
print_r($_SESSION);
echo "</pre>";

echo "<h2>📝 POST Data:</h2>";
echo "<pre>";
print_r($_POST);
echo "</pre>";

echo "<h2>🌐 Server Variables:</h2>";
echo "<pre>";
echo "REQUEST_METHOD: " . ($_SERVER['REQUEST_METHOD'] ?? 'BRAK') . "\n";
echo "HTTP_USER_AGENT: " . ($_SERVER['HTTP_USER_AGENT'] ?? 'BRAK') . "\n";
echo "REMOTE_ADDR: " . ($_SERVER['REMOTE_ADDR'] ?? 'BRAK') . "\n";
echo "REQUEST_TIME: " . date('Y-m-d H:i:s', $_SERVER['REQUEST_TIME']) . "\n";
echo "HTTP_REFERER: " . ($_SERVER['HTTP_REFERER'] ?? 'BRAK') . "\n";
echo "</pre>";

echo "<h2>📧 Test Funkcji Mail:</h2>";
if (function_exists('mail')) {
    echo "✅ Funkcja mail() jest dostępna<br>";
    
    // Test wysłania
    $test_result = mail("test@example.com", "Test", "Test message", "From: test@localhost");
    if ($test_result) {
        echo "✅ Test mail wysłany pomyślnie<br>";
    } else {
        echo "❌ Błąd wysyłania test maila<br>";
        echo "Błąd: " . error_get_last()['message'] . "<br>";
    }
} else {
    echo "❌ Funkcja mail() nie jest dostępna<br>";
}

echo "<h2>📁 Pliki w Katalogu:</h2>";
echo "<pre>";
$files = scandir('.');
foreach ($files as $file) {
    if ($file != '.' && $file != '..') {
        echo $file . " (" . filesize($file) . " bytes)\n";
    }
}
echo "</pre>";

echo "<h2>📋 Logi Błędów:</h2>";
if (file_exists('php_errors.log')) {
    echo "<pre>";
    echo file_get_contents('php_errors.log');
    echo "</pre>";
} else {
    echo "Brak pliku logów błędów<br>";
}

echo "<h2>🔧 Konfiguracja PHP:</h2>";
echo "<pre>";
echo "display_errors: " . ini_get('display_errors') . "\n";
echo "log_errors: " . ini_get('log_errors') . "\n";
echo "error_log: " . ini_get('error_log') . "\n";
echo "sendmail_path: " . ini_get('sendmail_path') . "\n";
echo "SMTP: " . ini_get('SMTP') . "\n";
echo "smtp_port: " . ini_get('smtp_port') . "\n";
echo "</pre>";
?>
