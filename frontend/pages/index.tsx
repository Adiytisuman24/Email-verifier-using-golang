"use client";
import { useState } from 'react';
import Head from 'next/head';

interface VerifyResponse {
  email: string;
  syntax_valid: boolean;
  domain: string;
  domain_has_mx: boolean;
  smtp_deliverable: boolean;
  mx_host_tried?: string;
  logs?: string[];
  error?: string;
}

export default function Home() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [currentStep, setCurrentStep] = useState('');
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  const verify = async () => {
    if (!email.trim()) return;
    
    setLoading(true);
    setResult(null);
    setCurrentStep('');
    
    // Show progressive steps for better UX
    const steps = [
      'Validating email syntax...',
      'Looking up domain MX records...',
      'Testing SMTP deliverability...'
    ];
    
    try {
      // Simulate step progression
      for (let i = 0; i < steps.length; i++) {
        setCurrentStep(steps[i]);
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      
      const response = await fetch(`${API_URL}/api/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setResult(data);
      
    } catch (error: any) {
      setResult({ 
        email,
        syntax_valid: false,
        domain: '',
        domain_has_mx: false,
        smtp_deliverable: false,
        error: `Connection error: ${error.message}`
      });
    } finally {
      setLoading(false);
      setCurrentStep('');
    }
  };

  const getStatusIcon = (status: boolean) => status ? '✅' : '❌';
  const getStatusText = (status: boolean) => status ? 'Valid' : 'Invalid';
  const getOverallStatus = () => {
    if (!result) return null;
    if (result.error) return { icon: '❌', text: 'Error', color: '#dc2626' };
    if (result.smtp_deliverable) return { icon: '✅', text: 'Deliverable', color: '#059669' };
    if (result.domain_has_mx) return { icon: '⚠️', text: 'Partial', color: '#d97706' };
    return { icon: '❌', text: 'Invalid', color: '#dc2626' };
  };

  return (
    <>
      <Head>
        <title>Email Verification Tool - Advanced SMTP Testing</title>
        <meta name="description" content="Professional email verification with syntax validation, DNS MX lookup, and real SMTP handshake testing" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div style={{ 
        maxWidth: 800, 
        margin: '40px auto', 
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}>
        <header style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: '700', 
            color: '#1f2937',
            marginBottom: '8px',
            letterSpacing: '-0.025em'
          }}>
            📧 Advanced Email Verification
          </h1>
          <p style={{ 
            fontSize: '18px', 
            color: '#6b7280',
            marginBottom: '0'
          }}>
            Professional validation: Enhanced Syntax • DNS MX Lookup • Real SMTP Handshake
          </p>
        </header>

        <div style={{ 
          background: 'white',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="email" style={{ 
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Email Address
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                style={{ 
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '2px solid #e5e7eb',
                  fontSize: '16px',
                  transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3b82f6';
                  e.target.style.boxShadow = '0 0 0 3px rgb(59 130 246 / 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                }}
                onKeyPress={(e) => e.key === 'Enter' && verify()}
              />
              <button
                onClick={verify}
                disabled={loading || !email.trim()}
                style={{ 
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  background: loading || !email.trim() ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease-in-out',
                  minWidth: '120px'
                }}
                onMouseEnter={(e) => {
                  if (!loading && email.trim()) {
                    e.currentTarget.style.background = '#2563eb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && email.trim()) {
                    e.currentTarget.style.background = '#3b82f6';
                  }
                }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                    <span style={{ 
                      display: 'inline-block',
                      width: '16px',
                      height: '16px',
                      border: '2px solid transparent',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></span>
                    Verifying...
                  </span>
                ) : 'Verify Email'}
              </button>
            </div>
          </div>

          {loading && currentStep && (
            <div style={{ 
              padding: '16px',
              background: '#f9fafb',
              borderRadius: '12px',
              marginBottom: '24px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: '20px',
                  height: '20px',
                  border: '2px solid #e5e7eb',
                  borderTop: '2px solid #3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <span style={{ color: '#374151', fontWeight: '500' }}>
                  {currentStep}
                </span>
              </div>
            </div>
          )}

          {result && !loading && (
            <div style={{ 
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              overflow: 'hidden'
            }}>
              <div style={{ 
                background: getOverallStatus()?.color === '#059669' ? '#f0fdf4' : 
                           getOverallStatus()?.color === '#d97706' ? '#fffbeb' : '#fef2f2',
                padding: '16px',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ 
                    margin: '0',
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1f2937'
                  }}>
                    Verification Results
                  </h3>
                  {getOverallStatus() && (
                    <span style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      fontSize: '16px',
                      fontWeight: '600',
                      color: getOverallStatus()!.color
                    }}>
                      {getOverallStatus()!.icon} {getOverallStatus()!.text}
                    </span>
                  )}
                </div>
                <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
                  {result.email}
                </p>
              </div>
              
              <div style={{ padding: '24px' }}>
                {result.error ? (
                  <div style={{ 
                    padding: '16px',
                    background: '#fef2f2',
                    borderRadius: '8px',
                    border: '1px solid #fecaca',
                    color: '#dc2626'
                  }}>
                    <strong>Error:</strong> {result.error}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '500', color: '#374151' }}>Enhanced Syntax Check:</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getStatusIcon(result.syntax_valid)}
                        <span style={{ color: result.syntax_valid ? '#059669' : '#dc2626', fontWeight: '500' }}>
                          {getStatusText(result.syntax_valid)}
                        </span>
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '500', color: '#374151' }}>DNS MX Records ({result.domain}):</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getStatusIcon(result.domain_has_mx)}
                        <span style={{ color: result.domain_has_mx ? '#059669' : '#dc2626', fontWeight: '500' }}>
                          {result.domain_has_mx ? 'Has MX Records' : 'No MX Records'}
                        </span>
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '500', color: '#374151' }}>SMTP Handshake Test:</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getStatusIcon(result.smtp_deliverable)}
                        <span style={{ color: result.smtp_deliverable ? '#059669' : '#dc2626', fontWeight: '500' }}>
                          {result.smtp_deliverable ? 'Passed' : 'Failed'}
                        </span>
                      </span>
                    </div>
                    
                    {result.mx_host_tried && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '500', color: '#374151' }}>Successful MX Server:</span>
                        <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>{result.mx_host_tried}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {result.logs && result.logs.length > 0 && (
                  <details style={{ marginTop: '24px' }}>
                    <summary style={{ 
                      cursor: 'pointer',
                      fontWeight: '500',
                      color: '#374151',
                      padding: '8px 0'
                    }}>
                      View Detailed Verification Logs ({result.logs.length} entries)
                    </summary>
                    <div style={{ 
                      marginTop: '12px',
                      padding: '16px',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <pre style={{ 
                        margin: '0',
                        fontSize: '12px',
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                        color: '#374151',
                        whiteSpace: 'pre-wrap',
                        lineHeight: '1.5'
                      }}>
                        {result.logs.join('\n')}
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>

        <footer style={{ 
          marginTop: '48px', 
          textAlign: 'center',
          color: '#6b7280',
          fontSize: '14px' 
        }}>
          <p style={{ marginBottom: '8px' }}>
            Backend API: <code style={{ 
              background: '#f3f4f6',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '13px'
            }}>{API_URL}</code>
          </p>
          <p style={{ margin: '0' }}>
            <strong>Note:</strong> Uses native Node.js net, dns modules with real SMTP handshake testing. Results are advisory as some servers implement rate limiting or catch-all policies.
          </p>
        </footer>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}