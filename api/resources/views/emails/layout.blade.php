<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display+SC:wght@400;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif;
      background: #F6F3EE;
      margin: 0;
      padding: 0;
      -webkit-text-size-adjust: 100%;
    }
    .wrapper {
      width: 100%;
      background: #F6F3EE;
      padding: 40px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(59, 47, 42, 0.08);
    }

    /* Header — Blue with logo */
    .header {
      background: #6492D8;
      padding: 32px 40px;
      text-align: center;
    }
    .header img {
      max-width: 220px;
      height: auto;
    }

    /* Body */
    .email-body {
      padding: 40px;
      color: #3B2F2A;
    }
    .email-body h2 {
      font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif;
      font-size: 22px;
      margin: 0 0 20px;
      color: #3B2F2A;
    }
    .content {
      line-height: 1.7;
      color: #5a4a44;
      font-size: 15px;
    }
    .content p {
      margin: 0 0 16px;
    }
    .content ul, .content ol {
      margin: 0 0 16px;
      padding-left: 24px;
    }
    .content li {
      margin-bottom: 6px;
    }
    .content a {
      color: #6492D8;
      text-decoration: underline;
    }
    .content strong {
      color: #3B2F2A;
    }

    /* Attachments */
    .attachments {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #F6F3EE;
    }
    .attachments-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #C8BFB6;
      margin-bottom: 10px;
    }
    .attachment-item {
      display: inline-block;
      background: #F6F3EE;
      border-radius: 8px;
      padding: 8px 14px;
      margin: 0 8px 8px 0;
      font-size: 13px;
      color: #3B2F2A;
    }

    /* Footer */
    .footer {
      padding: 24px 40px;
      text-align: center;
      border-top: 1px solid #F6F3EE;
    }
    .footer p {
      color: #C8BFB6;
      font-size: 12px;
      margin: 0;
      line-height: 1.6;
    }
    .footer a {
      color: #6492D8;
      text-decoration: none;
    }

    @@media only screen and (max-width: 620px) {
      .wrapper { padding: 20px 12px; }
      .header { padding: 24px 20px; }
      .header img { max-width: 180px; }
      .email-body { padding: 28px 24px; }
      .footer { padding: 20px 24px; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F6F3EE;font-family:'Lato','Helvetica Neue',Arial,sans-serif;">
  <div class="wrapper" style="width:100%;background-color:#F6F3EE;padding:40px 0;">
    <div class="container" style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(59,47,42,0.08);">
      {{-- Header --}}
      <div class="header" style="background-color:#6492D8;padding:32px 40px;text-align:center;">
        <img src="cid:logo@thepupperclub.ca" alt="The Pupper Club" style="max-width:220px;height:auto;" />
      </div>

      {{-- Content --}}
      <div class="email-body" style="padding:40px;color:#3B2F2A;background-color:#ffffff;">
        @yield('body')
      </div>

      {{-- Footer --}}
      <div class="footer" style="padding:24px 40px;text-align:center;border-top:1px solid #F6F3EE;background-color:#ffffff;">
        <p style="color:#C8BFB6;font-size:12px;margin:0;line-height:1.6;">&copy; {{ date('Y') }} The Pupper Club</p>
        <p style="color:#C8BFB6;font-size:12px;margin:0;line-height:1.6;">Port Moody, BC &middot; <a href="https://thepupperclub.ca" style="color:#6492D8;text-decoration:none;">thepupperclub.ca</a></p>
      </div>
    </div>
  </div>
</body>
</html>
