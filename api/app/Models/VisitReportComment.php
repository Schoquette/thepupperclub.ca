<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VisitReportComment extends Model
{
    protected $fillable = ['visit_report_id', 'user_id', 'body'];

    public function visitReport(): BelongsTo
    {
        return $this->belongsTo(VisitReport::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
