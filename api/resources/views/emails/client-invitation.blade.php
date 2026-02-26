<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Lato', Arial, sans-serif; background: #F6F3EE; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #3B2F2A; padding: 32px 40px; text-align: center; }
    .header h1 { color: #C9A24D; font-family: Georgia, serif; margin: 0; font-size: 28px; letter-spacing: 1px; }
    .header p { color: #C8BFB6; margin: 8px 0 0; font-size: 14px; }
    .body { padding: 40px; color: #3B2F2A; }
    .body h2 { font-size: 22px; margin-bottom: 16px; }
    .body p { line-height: 1.6; color: #5a4a44; margin-bottom: 16px; }
    .button { display: inline-block; background: #C9A24D; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; margin: 8px 0; }
    .code-box { background: #F6F3EE; border: 1px solid #C8BFB6; border-radius: 8px; padding: 16px 24px; font-family: monospace; font-size: 18px; letter-spacing: 2px; text-align: center; margin: 16px 0; }
    .footer { padding: 24px 40px; text-align: center; color: #C8BFB6; font-size: 12px; border-top: 1px solid #F6F3EE; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>THE PUPPER CLUB</h1>
      <p>Premium Dog Walking & Care</p>
    </div>
    <div class="body">
      <h2>Welcome, {{ $user->name }}! 🐾</h2>
      <p>Sophie has set up your client account at The Pupper Club. You're just a few steps away from accessing your portal.</p>

      @if($tempPassword)
      <p>Your temporary password is:</p>
      <div class="code-box">{{ $tempPassword }}</div>
      @endif

      <p>Click the button below to set your permanent password and get started:</p>
      <p style="text-align:center">
        <a href="{{ $setPasswordUrl }}" class="button">Set My Password</a>
      </p>

      <p style="font-size:13px; color:#888">This link expires in 7 days. If you have any questions, reply to this email or contact Sophie directly.</p>
    </div>
    <div class="footer">
      <p>The Pupper Club · Vancouver, BC · thepupperclub.ca</p>
    </div>
  </div>
</body>
</html>
