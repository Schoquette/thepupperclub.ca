<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Wrap any existing plain-string values in a JSON array before
        // widening the column, so multiple interactions (e.g. "Selective"
        // + "Ignores") can be selected instead of just one.
        DB::table('dogs')
            ->whereNotNull('interaction_dogs')
            ->where('interaction_dogs', '!=', '')
            ->orderBy('id')
            ->each(function ($dog) {
                $decoded = json_decode($dog->interaction_dogs, true);
                if (is_array($decoded)) return; // already migrated
                DB::table('dogs')->where('id', $dog->id)
                    ->update(['interaction_dogs' => json_encode([$dog->interaction_dogs])]);
            });

        DB::statement('ALTER TABLE dogs MODIFY COLUMN interaction_dogs JSON NULL');
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE dogs MODIFY COLUMN interaction_dogs VARCHAR(50) NULL");
    }
};
