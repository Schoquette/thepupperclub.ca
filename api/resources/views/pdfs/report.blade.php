<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: DejaVu Sans, sans-serif; color: #3B2F2A; font-size: 10px; padding: 24px; }

    .header { border-bottom: 2px solid #C9A24D; padding-bottom: 12px; margin-bottom: 16px; }
    .logo   { font-size: 18px; font-weight: bold; color: #3B2F2A; }
    .tagline { font-size: 9px; color: #C8BFB6; margin-top: 2px; }
    .report-title { font-size: 14px; font-weight: bold; color: #C9A24D; margin-top: 8px; }
    .date-range   { font-size: 10px; color: #C8BFB6; margin-top: 2px; }

    /* Summary cards */
    .summary { margin-bottom: 16px; }
    .summary table { border-collapse: collapse; }
    .summary td {
      padding: 6px 14px;
      background: #F6F3EE;
      border-right: 2px solid #fff;
      vertical-align: top;
    }
    .summary .lbl { font-size: 8px; color: #C8BFB6; text-transform: uppercase; letter-spacing: 0.04em; display: block; }
    .summary .val { font-size: 13px; font-weight: bold; color: #3B2F2A; display: block; margin-top: 2px; }

    /* Data table */
    table.data { width: 100%; border-collapse: collapse; margin-top: 4px; }
    table.data th {
      background: #6492D8;
      color: #F6F3EE;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 6px 5px;
      text-align: left;
      white-space: nowrap;
    }
    table.data td {
      padding: 5px 5px;
      font-size: 9px;
      border-bottom: 1px solid #F6F3EE;
      vertical-align: top;
      word-break: break-word;
    }
    table.data tr:nth-child(even) td { background: #FAFAF8; }
    table.data tr:hover td { background: #F6F3EE; }

    .footer {
      margin-top: 20px;
      border-top: 1px solid #F6F3EE;
      padding-top: 8px;
      font-size: 8px;
      color: #C8BFB6;
      text-align: center;
    }

    .empty-msg {
      text-align: center;
      padding: 30px;
      color: #C8BFB6;
      font-size: 12px;
    }
  </style>
</head>
<body>

  <div class="header">
    <div class="logo">The Pupper Club</div>
    <div class="tagline">Curated Dog Care</div>
    <div class="report-title">{{ $title }}</div>
    <div class="date-range">{{ $dateRange }}</div>
  </div>

  {{-- Summary --}}
  @if(!empty($summary))
  <div class="summary">
    <table>
      <tr>
        @foreach($summary as $label => $value)
        <td>
          <span class="lbl">{{ $label }}</span>
          <span class="val">{{ $value }}</span>
        </td>
        @endforeach
      </tr>
    </table>
  </div>
  @endif

  {{-- Data Table --}}
  @if(count($rows) > 0)
  <table class="data">
    <thead>
      <tr>
        @foreach($columns as $col)
        <th>{{ $col }}</th>
        @endforeach
      </tr>
    </thead>
    <tbody>
      @foreach($rows as $row)
      <tr>
        @foreach($row as $cell)
        <td>{{ $cell }}</td>
        @endforeach
      </tr>
      @endforeach
    </tbody>
  </table>
  @else
  <div class="empty-msg">No records found for this date range.</div>
  @endif

  <div class="footer">
    The Pupper Club &bull; {{ $title }} &bull; {{ $dateRange }} &bull; Generated {{ now()->format('M j, Y g:i A') }}
  </div>

</body>
</html>
