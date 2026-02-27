<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_documents', function (Blueprint $table) {
            $table->timestamp('signature_requested_at')->nullable()->after('uploaded_by');
            $table->string('signature_token', 64)->nullable()->unique()->after('signature_requested_at');
            $table->timestamp('signed_at')->nullable()->after('signature_token');
            $table->string('signer_name')->nullable()->after('signed_at');
            $table->string('signer_ip')->nullable()->after('signer_name');
            $table->longText('signature_data')->nullable()->after('signer_ip');
            $table->string('signed_pdf_path')->nullable()->after('signature_data');
        });
    }

    public function down(): void
    {
        Schema::table('client_documents', function (Blueprint $table) {
            $table->dropColumn([
                'signature_requested_at', 'signature_token', 'signed_at',
                'signer_name', 'signer_ip', 'signature_data', 'signed_pdf_path',
            ]);
        });
    }
};
