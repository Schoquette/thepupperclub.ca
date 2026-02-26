import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';

const STEP_INFO = {
  set_password:  { title: 'Set Your Password',    icon: '🔑', description: 'Create a secure password for your account.' },
  welcome:       { title: 'Welcome to the Club',  icon: '🎉', description: 'Learn about what to expect from The Pupper Club.' },
  profile:       { title: 'Your Profile',         icon: '👤', description: 'Fill in your contact and emergency info.' },
  home_access:   { title: 'Home Access',          icon: '🏠', description: 'Provide entry instructions for your walker.' },
  dog_profiles:  { title: 'Dog Profile(s)',       icon: '🐕', description: 'Tell us about your furry family member(s).' },
  payment:       { title: 'Payment Method',       icon: '💳', description: 'Set up your billing preferences.' },
  agreement:     { title: 'Service Agreement',    icon: '📄', description: 'Review and sign the service agreement.' },
  confirmation:  { title: 'All Done!',            icon: '✅', description: 'Your account is fully set up.' },
};

const STEP_ORDER = Object.keys(STEP_INFO) as (keyof typeof STEP_INFO)[];

export default function ClientOnboardingPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: () => api.get('/client/onboarding/status').then(r => r.data.data),
  });

  const completeStep = useMutation({
    mutationFn: (step: string) => api.patch(`/client/onboarding/step/${step}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding-status'] }),
  });

  if (isLoading) return <PageLoader />;

  const steps = data?.steps ?? {};
  const completedCount = Object.values(steps).filter((s: any) => s.completed).length;
  const total = STEP_ORDER.length;
  const progress = Math.round((completedCount / total) * 100);

  if (data?.completed) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="text-5xl">🎉</div>
        <h1 className="font-display text-2xl text-espresso">You're all set!</h1>
        <p className="text-taupe">Your account is fully set up. Welcome to The Pupper Club!</p>
        <Button onClick={() => navigate('/client')}>Go to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl text-espresso">Welcome! Let's get you set up.</h1>
        <p className="text-taupe mt-1 text-sm">{completedCount} of {total} steps complete</p>
        <div className="mt-3 h-2 bg-cream rounded-full overflow-hidden">
          <div className="h-full bg-gold rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="space-y-3">
        {STEP_ORDER.map((step, idx) => {
          const info = STEP_INFO[step];
          const stepData = steps[step];
          const isComplete = stepData?.completed;
          const isCurrent = !isComplete && STEP_ORDER.slice(0, idx).every(s => steps[s]?.completed);

          return (
            <div
              key={step}
              className={`bg-white rounded-xl p-5 border-2 transition-all ${
                isCurrent ? 'border-gold shadow-lg' : isComplete ? 'border-green-200' : 'border-transparent shadow-card'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${
                  isComplete ? 'bg-green-100' : isCurrent ? 'bg-gold/10' : 'bg-cream'
                }`}>
                  {isComplete ? '✅' : info.icon}
                </div>
                <div className="flex-1">
                  <div className={`font-semibold text-sm ${isComplete ? 'text-green-700' : 'text-espresso'}`}>
                    {idx + 1}. {info.title}
                  </div>
                  <div className="text-xs text-taupe mt-0.5">{info.description}</div>
                </div>
                {isCurrent && (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (step === 'profile') navigate('/client/profile');
                      else if (step === 'dog_profiles') navigate('/client/dogs');
                      else completeStep.mutate(step);
                    }}
                  >
                    {step === 'confirmation' ? 'Complete!' : 'Continue →'}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
