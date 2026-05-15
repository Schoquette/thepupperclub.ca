<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DejaVu Sans', sans-serif; color: #3B2F2A; font-size: 11px; padding: 0; }

    .header {
      background: #F6F3EE;
      padding: 28px 40px;
      text-align: center;
      border-bottom: 3px solid #C9A24D;
    }
    .header img { max-width: 180px; height: auto; }
    .header-text { color: #C8BFB6; font-size: 10px; margin-top: 8px; letter-spacing: 0.05em; }

    .body-content { padding: 32px 40px; }

    .doc-title { font-size: 16px; font-weight: bold; color: #3B2F2A; margin-bottom: 8px; }
    .doc-meta {
      font-size: 10px;
      color: #3B2F2A;
      margin-bottom: 24px;
      padding-bottom: 14px;
      border-bottom: 2px solid #6492D8;
    }

    .badge {
      display: inline-block;
      background: #6492D8;
      color: #ffffff;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: bold;
    }

    .section { margin-bottom: 20px; }
    .section-title {
      font-size: 12px;
      font-weight: bold;
      color: #6492D8;
      border-bottom: 1px solid #F6F3EE;
      padding-bottom: 4px;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    table.fields { width: 100%; border-collapse: collapse; }
    table.fields td { padding: 4px 6px; vertical-align: top; font-size: 11px; }
    table.fields .lbl { width: 38%; color: #3B2F2A; font-weight: bold; }
    table.fields .val { color: #3B2F2A; }

    .signature-box {
      background: #F6F3EE;
      border-radius: 5px;
      padding: 14px;
      margin-top: 10px;
      page-break-inside: avoid;
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
      margin-top: 30px;
      border-top: 2px solid #6492D8;
      padding: 16px 40px;
      font-size: 9px;
      color: #3B2F2A;
      text-align: center;
    }
  </style>
</head>
<body>

  {{-- Branded header --}}
  <div class="header">
    @php
      $logoPath = public_path('images/logo-dark-stacked.png');
    @endphp
    @if(file_exists($logoPath))
      <img src="{{ $logoPath }}" alt="The Pupper Club" />
    @else
      <div style="color:#3B2F2A;font-size:20px;font-weight:bold;letter-spacing:2px;">The Pupper Club</div>
    @endif
    <div class="header-text">Curated Dog Care &bull; Port Moody, BC</div>
  </div>

  <div class="body-content">
    <div class="doc-title">Document Signing Certificate</div>
    <div class="doc-meta">
      <span class="badge">{{ isset($countersigned_at) ? 'Fully Executed' : 'Signed' }}</span>
    </div>

    <div class="section">
      <div class="section-title">Document Details</div>
      <table class="fields">
        <tr><td class="lbl">Document</td><td class="val">{{ $document->filename }}</td></tr>
        <tr><td class="lbl">Client</td><td class="val">{{ $document->user?->name ?? '—' }}</td></tr>
        <tr><td class="lbl">Signature Requested</td><td class="val">{{ $document->signature_requested_at?->setTimezone('America/Vancouver')->format('F j, Y \a\t g:i A T') ?? '—' }}</td></tr>
      </table>
    </div>

    @if(($client_fields ?? collect())->isNotEmpty())
    <div class="section">
      <div class="section-title">Client Form Inputs</div>
      <table class="fields">
        @foreach($client_fields as $row)
          <tr>
            <td class="lbl">{{ $row['label'] }}</td>
            <td class="val">{{ $row['value'] }}</td>
          </tr>
        @endforeach
      </table>
    </div>
    @endif

    @if(($company_fields ?? collect())->isNotEmpty())
    <div class="section">
      <div class="section-title">Company Form Inputs</div>
      <table class="fields">
        @foreach($company_fields as $row)
          <tr>
            <td class="lbl">{{ $row['label'] }}</td>
            <td class="val">{{ $row['value'] }}</td>
          </tr>
        @endforeach
      </table>
    </div>
    @endif

    <div class="section">
      <div class="section-title">Client Signature</div>
      <table class="fields">
        <tr><td class="lbl">Signed By</td><td class="val">{{ $signer_name }}</td></tr>
        <tr><td class="lbl">Date &amp; Time</td><td class="val">{{ $signed_at->setTimezone('America/Vancouver')->format('F j, Y \a\t g:i A T') }}</td></tr>
        <tr><td class="lbl">IP Address</td><td class="val">{{ $signer_ip }}</td></tr>
      </table>

      <div class="signature-box">
        <div class="label">Client Signature</div>
        @if($signature_png)
          <img class="signature-img" src="data:image/png;base64,{{ $signature_png }}" alt="Client Signature" />
        @else
          <p style="color: #C8BFB6; font-style: italic;">No signature image available.</p>
        @endif
      </div>
    </div>

    @if(isset($countersigned_at) && $countersigned_at)
    <div class="section">
      <div class="section-title">Company Counter-Signature</div>
      <table class="fields">
        <tr><td class="lbl">Counter-Signed By</td><td class="val">{{ $countersigner_name }}</td></tr>
        <tr><td class="lbl">Date &amp; Time</td><td class="val">{{ $countersigned_at->setTimezone('America/Vancouver')->format('F j, Y \a\t g:i A T') }}</td></tr>
        <tr><td class="lbl">IP Address</td><td class="val">{{ $countersigner_ip }}</td></tr>
      </table>

      <div class="signature-box">
        <div class="label">Company Signature — The Pupper Club</div>
        @if(isset($countersign_png) && $countersign_png)
          <img class="signature-img" src="data:image/png;base64,{{ $countersign_png }}" alt="Company Signature" />
        @else
          <p style="color: #C8BFB6; font-style: italic;">No signature image available.</p>
        @endif
      </div>
    </div>
    @endif
  </div>

  <div class="footer">
    <p>This certificate was automatically generated by The Pupper Club client portal.</p>
    <p style="margin-top: 4px;">The signature(s) and metadata above constitute a valid record of electronic consent.</p>
  </div>

</body>
</html>
