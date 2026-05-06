<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DejaVu Sans', sans-serif; color: #3B2F2A; font-size: 12px; }

    .header-bar {
      background: #F6F3EE;
      padding: 28px 40px;
      border-bottom: 3px solid #C9A24D;
    }
    .brand  { font-size: 18px; font-weight: bold; letter-spacing: 2px; color: #3B2F2A; text-transform: uppercase; }
    .sub    { font-size: 10px; color: #C8BFB6; margin-top: 2px; }

    .body-content { padding: 36px 40px; }

    h1 { font-size: 20px; font-weight: bold; color: #3B2F2A; margin-bottom: 8px; }

    .badge {
      display: inline-block;
      background: #6492D8;
      color: #ffffff;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: bold;
      margin-bottom: 24px;
    }

    .section { margin-bottom: 22px; }
    .section-title {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #C8BFB6;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #F6F3EE;
    }
    .field { padding: 6px 0; border-bottom: 1px solid #F6F3EE; }
    .field-label { color: #C8BFB6; font-size: 11px; }
    .field-value { font-weight: bold; color: #3B2F2A; font-size: 12px; }

    .signature-box {
      border: 1px solid #C8BFB6;
      border-radius: 8px;
      padding: 16px;
      margin-top: 20px;
      background: #F6F3EE;
    }
    .signature-box .label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #C8BFB6;
      margin-bottom: 8px;
    }
    .signature-img { max-width: 300px; max-height: 100px; display: block; }

    .footer {
      margin-top: 32px;
      border-top: 2px solid #C9A24D;
      padding: 16px 40px;
      font-size: 9px;
      color: #C8BFB6;
      text-align: center;
    }
  </style>
</head>
<body>

  <div class="header-bar">
    <div class="brand">The Pupper Club</div>
    <div class="sub">Curated Dog Care</div>
  </div>

  <div class="body-content">
    <h1>Document Signing Certificate</h1>
    <div class="badge">{{ isset($countersigned_at) ? 'Fully Executed' : 'Signed' }}</div>

    <div class="section">
      <div class="section-title">Document Details</div>
      <div class="field">
        <span class="field-label">Document</span><br>
        <span class="field-value">{{ $document->filename }}</span>
      </div>
      <div class="field">
        <span class="field-label">Client</span><br>
        <span class="field-value">{{ $document->user?->name ?? '—' }}</span>
      </div>
      <div class="field">
        <span class="field-label">Signature Requested</span><br>
        <span class="field-value">{{ $document->signature_requested_at?->setTimezone('America/Vancouver')->format('F j, Y \a\t g:i A T') ?? '—' }}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Client Signature</div>
      <div class="field">
        <span class="field-label">Signed By</span><br>
        <span class="field-value">{{ $signer_name }}</span>
      </div>
      <div class="field">
        <span class="field-label">Date &amp; Time</span><br>
        <span class="field-value">{{ $signed_at->setTimezone('America/Vancouver')->format('F j, Y \a\t g:i A T') }}</span>
      </div>
      <div class="field">
        <span class="field-label">IP Address</span><br>
        <span class="field-value">{{ $signer_ip }}</span>
      </div>
    </div>

    <div class="signature-box">
      <div class="label">Client Signature</div>
      @if($signature_png)
        <img class="signature-img" src="data:image/png;base64,{{ $signature_png }}" alt="Client Signature" />
      @else
        <p style="color: #C8BFB6; font-style: italic;">No signature image available.</p>
      @endif
    </div>

    @if(isset($countersigned_at) && $countersigned_at)
    <div class="section" style="margin-top: 28px;">
      <div class="section-title">Company Counter-Signature</div>
      <div class="field">
        <span class="field-label">Counter-Signed By</span><br>
        <span class="field-value">{{ $countersigner_name }}</span>
      </div>
      <div class="field">
        <span class="field-label">Date &amp; Time</span><br>
        <span class="field-value">{{ $countersigned_at->setTimezone('America/Vancouver')->format('F j, Y \a\t g:i A T') }}</span>
      </div>
      <div class="field">
        <span class="field-label">IP Address</span><br>
        <span class="field-value">{{ $countersigner_ip }}</span>
      </div>
    </div>

    <div class="signature-box">
      <div class="label">Company Signature — The Pupper Club</div>
      @if(isset($countersign_png) && $countersign_png)
        <img class="signature-img" src="data:image/png;base64,{{ $countersign_png }}" alt="Company Signature" />
      @else
        <p style="color: #C8BFB6; font-style: italic;">No signature image available.</p>
      @endif
    </div>
    @endif
  </div>

  <div class="footer">
    <p>This certificate was automatically generated by The Pupper Club client portal.</p>
    <p style="margin-top: 4px;">The signature(s) and metadata above constitute a valid record of electronic consent.</p>
  </div>

</body>
</html>
