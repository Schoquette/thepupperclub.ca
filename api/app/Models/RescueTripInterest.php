<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RescueTripInterest extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'email',
        'trip_slug',
        'trip_label',
        'comments',
        'source_url',
        'ip_address',
        'user_agent',
    ];
}
