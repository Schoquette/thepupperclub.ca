<?php
// SPA fallback — serve index.html for all non-file routes
readfile(__DIR__ . '/index.html');
