import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { ApiUtils } from '../../services/api';
import Spinner from '../common/Spinner';
import {
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  IdCard,
  FileText,
  ArrowLeft,
  Check,
  AlertCircle,
  Fingerprint,
  BadgeCheck,
  ScanLine,
  CreditCard,
  FileCheck,
} from 'lucide-react';
import Menu from '../Menu';
import toast, { Toaster } from 'react-hot-toast';

const KYC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useUserAuth();
  const [kycData, setKycData]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [activeStep, setActiveStep]   = useState(1);
  const [formData, setFormData]       = useState({
    firstName: '', lastName: '', dateOfBirth: '',
    nationality: '', country: '', city: '', address: '', postalCode: '',
  });
  const [documents, setDocuments]             = useState({ front: null, back: null });
  const [previews, setPreviews]               = useState({ front: null, back: null });
  const [selectedDocumentType, setSelectedDocumentType] = useState('');
  const [uploadProgress, setUploadProgress]   = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [generalError, setGeneralError]       = useState('');
  const [submitLoading, setSubmitLoading]     = useState(false);

  useEffect(() => { fetchKycStatus(); }, []);

  const fetchKycStatus = async () => {
    try {
      const res = await ApiUtils.get('/kyc/status');
      setKycData(res);
      if (res.personalInfo) {
        setFormData({
          firstName:   res.personalInfo.firstName   || '',
          lastName:    res.personalInfo.lastName    || '',
          dateOfBirth: res.personalInfo.dateOfBirth
            ? new Date(res.personalInfo.dateOfBirth).toISOString().split('T')[0] : '',
          nationality: res.personalInfo.nationality || '',
          country:     res.personalInfo.country     || '',
          city:        res.personalInfo.city        || '',
          address:     res.personalInfo.address     || '',
          postalCode:  res.personalInfo.postalCode  || '',
        });
      }
      if (res.status === 'not_started') setActiveStep(1);
      else if (res.status === 'personal_info_submitted') setActiveStep(2);
      else if (['documents_uploaded','pending_review','pending','approved','rejected'].includes(res.status)) setActiveStep(3);
    } catch (e) {
      console.error('KYC status error', e);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(p => ({ ...p, [name]: value }));
    if (validationErrors[name]) setValidationErrors(p => ({ ...p, [name]: '' }));
    if (generalError) setGeneralError('');
  };

  const validateAge = (dob) => {
    if (!dob) return false;
    const b = new Date(dob);
    if (isNaN(b.getTime())) return false;
    const t = new Date();
    const age = t.getFullYear() - b.getFullYear();
    const m = t.getMonth() - b.getMonth();
    return (m < 0 || (m === 0 && t.getDate() < b.getDate())) ? age - 1 >= 18 : age >= 18;
  };

  const validateForm = () => {
    const e = {};
    if (!formData.firstName  || formData.firstName.length  < 2)  e.firstName  = t('kyc.firstNameError');
    if (!formData.lastName   || formData.lastName.length   < 2)  e.lastName   = t('kyc.lastNameError');
    if (!formData.dateOfBirth) {
      e.dateOfBirth = t('kyc.dobRequired');
    } else if (isNaN(new Date(formData.dateOfBirth).getTime())) {
      e.dateOfBirth = t('kyc.validDate');
    } else if (!validateAge(formData.dateOfBirth)) {
      e.dateOfBirth = t('kyc.minAge');
    }
    if (!formData.nationality || formData.nationality.length < 2) e.nationality = t('kyc.nationalityRequired');
    if (!formData.country    || formData.country.length    < 2)  e.country    = t('kyc.countryRequired');
    if (!formData.city       || formData.city.length       < 2)  e.city       = t('kyc.cityRequired');
    if (!formData.address    || formData.address.length    < 10) e.address    = t('kyc.addressError');
    if (!formData.postalCode || formData.postalCode.length < 3)  e.postalCode = t('kyc.postalCodeRequired');
    setValidationErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePersonalInfoSubmit = async (ev) => {
    ev.preventDefault();
    setValidationErrors({}); setGeneralError('');
    if (!validateForm()) return;
    setSubmitLoading(true);
    try {
      const res = await ApiUtils.post('/kyc/personal-info', formData);
      if (res.success) { toast.success(t('kyc.personalInfoSuccess')); setActiveStep(2); }
      else if (res.details?.length) {
        const errs = {};
        res.details.forEach(d => { if (d.path?.[0]) errs[d.path[0]] = d.message; });
        setValidationErrors(errs); toast.error(t('kyc.pleaseFixErrors'));
      } else {
        const msg = res.error || t('kyc.failedToSubmitPersonalInfo');
        setGeneralError(msg); toast.error(msg);
      }
    } catch {
      const msg = t('kyc.failedToSubmitPersonalInfo');
      setGeneralError(msg); toast.error(msg);
    } finally { setSubmitLoading(false); }
  };

  const handleFileUpload = async (side, file) => {
    if (file.size > 5 * 1024 * 1024)                      { toast.error(t('kyc.fileTooLarge')); return; }
    if (!['image/jpeg','image/jpg','image/png'].includes(file.type)) { toast.error(t('kyc.validImageFile')); return; }
    if (!selectedDocumentType)                             { toast.error(t('kyc.selectDocumentTypeFirst')); return; }

    setPreviews(p => ({ ...p, [side]: URL.createObjectURL(file) }));
    const key = `${selectedDocumentType}_${side}`;
    setUploadProgress(p => ({ ...p, [key]: 0 }));

    const fd = new FormData();
    fd.append('document', file);
    fd.append('type', selectedDocumentType);
    fd.append('side', side);

    try {
      const interval = setInterval(() => {
        setUploadProgress(p => {
          const cur = p[key] || 0;
          return cur < 90 ? { ...p, [key]: cur + 10 } : p;
        });
      }, 100);
      const res = await ApiUtils.postFormData('/kyc/upload-document', fd);
      clearInterval(interval);
      if (res.success) {
        setUploadProgress(p => ({ ...p, [key]: 100 }));
        setDocuments(p => ({ ...p, [side]: { file, type: selectedDocumentType, uploaded: true, uploadedAt: new Date().toISOString() } }));
        toast.success(side === 'front' ? t('kyc.uploadedFront') : t('kyc.uploadedBack'));
      } else {
        toast.error(res.error || t('kyc.failedToUploadDocument'));
        setUploadProgress(p => ({ ...p, [key]: 0 }));
        setPreviews(p => ({ ...p, [side]: null }));
      }
    } catch {
      toast.error(t('kyc.failedToUploadDocumentRetry'));
      setUploadProgress(p => ({ ...p, [key]: 0 }));
      setPreviews(p => ({ ...p, [side]: null }));
    }
  };

  const handleCompleteKyc = async () => {
    if (!selectedDocumentType) { toast.error(t('kyc.selectDocumentTypeFirst')); return; }
    const needsBoth = selectedDocumentType !== 'passport';
    if (!documents.front?.uploaded || (needsBoth && !documents.back?.uploaded)) {
      toast.error(needsBoth ? t('kyc.uploadBothSides') : t('kyc.uploadedFront'));
      return;
    }
    setSubmitLoading(true);
    try {
      const res = await ApiUtils.post('/kyc/complete');
      if (res.success) { setActiveStep(3); fetchKycStatus(); toast.success(t('kyc.kycSubmittedSuccess')); }
      else toast.error(res.error || t('kyc.failedToCompleteKyc'));
    } catch (err) {
      toast.error(err.message?.includes('HTTP 400') ? t('kyc.validationErrorEnsureDocuments') : t('kyc.failedToCompleteKycRetry'));
    } finally { setSubmitLoading(false); }
  };

  /* ── helpers ── */
  const statusMeta = {
    approved:          { icon: CheckCircle, color: 'text-green-500',  bg: 'bg-green-50',  ring: 'ring-green-200',  badge: 'text-green-700 bg-green-100',  label: t('kyc.statusApproved'),       title: t('kyc.verificationApproved'), desc: t('kyc.identityVerified') },
    rejected:          { icon: XCircle,     color: 'text-red-500',    bg: 'bg-red-50',    ring: 'ring-red-200',    badge: 'text-red-700 bg-red-100',      label: t('kyc.statusRejected'),       title: t('kyc.verificationRejected'), desc: t('kyc.verificationNotApproved') },
    pending:           { icon: Clock,       color: 'text-[#0052FF]',  bg: 'bg-[#F0F5FF]', ring: 'ring-[#0052FF]/20', badge: 'text-[#0052FF] bg-[#0052FF]/10', label: t('kyc.statusUnderReview'),   title: t('kyc.underReview'),          desc: t('kyc.reviewingDocuments') },
    pending_review:    { icon: Clock,       color: 'text-[#0052FF]',  bg: 'bg-[#F0F5FF]', ring: 'ring-[#0052FF]/20', badge: 'text-[#0052FF] bg-[#0052FF]/10', label: t('kyc.statusUnderReview'),   title: t('kyc.underReview'),          desc: t('kyc.reviewingDocuments') },
    documents_uploaded:{ icon: FileText,    color: 'text-[#0052FF]',  bg: 'bg-[#F0F5FF]', ring: 'ring-[#0052FF]/20', badge: 'text-[#0052FF] bg-[#0052FF]/10', label: t('kyc.statusUnderReview'),   title: t('kyc.documentsSubmitted'),   desc: t('kyc.documentsUploadedPending') },
  };
  const sm = statusMeta[kycData?.status] || {
    icon: Shield, color: 'text-[#888888]', bg: 'bg-[#F9F9F9]', ring: 'ring-gray-200',
    badge: 'text-[#888888] bg-[#F9F9F9]', label: t('kyc.statusNotStarted'), title: t('kyc.completeVerification'), desc: t('kyc.completeAllSteps'),
  };

  const docTypes = [
    { value: 'passport',       label: t('kyc.passport'),       Icon: FileText   },
    { value: 'id_card',        label: t('kyc.nationalIdCard'), Icon: CreditCard },
    { value: 'driver_license', label: t('kyc.driverLicense'),  Icon: IdCard     },
  ];
  const needsBoth = selectedDocumentType === 'id_card' || selectedDocumentType === 'driver_license';
  const canContinue = selectedDocumentType && documents.front?.uploaded && (!needsBoth || documents.back?.uploaded);

  const inputCls = (err) =>
    `w-full bg-transparent border-b-2 py-3 text-[15px] text-[#111111] placeholder-[#CCCCCC] focus:outline-none transition-colors ${
      err ? 'border-red-400' : 'border-[#EEEEEE] focus:border-[#0052FF]'
    }`;

  if (loading && !kycData) return <Spinner />;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Toaster />

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 pt-10 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F5F5F5] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[#111111]" />
        </button>
        <div className="flex-1">
          <h1 className="text-[18px] font-bold text-[#111111] leading-tight">{t('kyc.kycVerification')}</h1>
        </div>
        {/* Step pill */}
        <span className="text-xs font-semibold text-[#0052FF] bg-[#0052FF]/10 px-2.5 py-1 rounded-full">
          {activeStep} / 3
        </span>
      </div>

      {/* ── Step progress bar ── */}
      <div className="px-4 mb-6">
        <div className="flex gap-1.5">
          {[1,2,3].map(s => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                activeStep >= s ? 'bg-[#0052FF]' : 'bg-[#EEEEEE]'
              }`}
            />
          ))}
        </div>
        <p className="text-[12px] text-[#888888] mt-2">
          {activeStep === 1 ? t('kyc.personalInformation') : activeStep === 2 ? t('kyc.documentUpload') : t('kyc.reviewStatus')}
        </p>
      </div>

      {/* ── Step content ── */}
      <div className="flex-1 px-4 pb-32 overflow-y-auto">

        {/* ════ STEP 1 ════ */}
        {activeStep === 1 && (
          <form onSubmit={handlePersonalInfoSubmit}>

            {/* Section: Identity */}
            <SectionLabel icon={Fingerprint} title="Identity" />

            <Field label={t('kyc.firstName')} error={validationErrors.firstName}>
              <input name="firstName" value={formData.firstName} onChange={handleInputChange}
                placeholder="John" className={inputCls(validationErrors.firstName)} />
            </Field>
            <Field label={t('kyc.lastName')} error={validationErrors.lastName}>
              <input name="lastName" value={formData.lastName} onChange={handleInputChange}
                placeholder="Doe" className={inputCls(validationErrors.lastName)} />
            </Field>
            <Field label={t('kyc.dateOfBirth')} error={validationErrors.dateOfBirth} hint={!validationErrors.dateOfBirth ? t('kyc.ageRequirement') : undefined}>
              <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleInputChange}
                max={new Date().toISOString().split('T')[0]} className={inputCls(validationErrors.dateOfBirth)} />
            </Field>
            <Field label={t('kyc.nationality')} error={validationErrors.nationality}>
              <input name="nationality" value={formData.nationality} onChange={handleInputChange}
                placeholder="e.g. British" className={inputCls(validationErrors.nationality)} />
            </Field>

            <div className="mt-8 mb-2 h-px bg-[#F5F5F5]" />

            {/* Section: Location */}
            <SectionLabel icon={BadgeCheck} title="Location" />

            <Field label={t('kyc.country')} error={validationErrors.country}>
              <input name="country" value={formData.country} onChange={handleInputChange}
                placeholder="e.g. United Kingdom" className={inputCls(validationErrors.country)} />
            </Field>
            <Field label={t('kyc.city')} error={validationErrors.city}>
              <input name="city" value={formData.city} onChange={handleInputChange}
                placeholder="e.g. London" className={inputCls(validationErrors.city)} />
            </Field>
            <Field label={t('kyc.address')} error={validationErrors.address}>
              <input name="address" value={formData.address} onChange={handleInputChange}
                placeholder="Street address" className={inputCls(validationErrors.address)} />
            </Field>
            <Field label={t('kyc.postalCode')} error={validationErrors.postalCode}>
              <input name="postalCode" value={formData.postalCode} onChange={handleInputChange}
                placeholder="Postal / ZIP" className={inputCls(validationErrors.postalCode)} />
            </Field>

            {generalError && (
              <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{generalError}</p>
              </div>
            )}

            {/* sticky bottom button rendered via portal-like fixed div */}
            <BottomBtn loading={submitLoading} label={t('kyc.continueToDocuments')} loadingLabel={t('kyc.submitting')} />
          </form>
        )}

        {/* ════ STEP 2 ════ */}
        {activeStep === 2 && (
          <div>
            <SectionLabel icon={ScanLine} title={t('kyc.selectDocumentType')} />

            {/* Document type pills */}
            <div className="flex gap-2 mt-2 mb-8">
              {docTypes.map(({ value, label, Icon }) => {
                const sel = selectedDocumentType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setSelectedDocumentType(value);
                      setDocuments({ front: null, back: null });
                      setPreviews({ front: null, back: null });
                      setUploadProgress({});
                    }}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-3.5 rounded-2xl border-2 transition-all duration-200 ${
                      sel ? 'border-[#0052FF] bg-[#0052FF]/8' : 'border-[#EEEEEE] bg-[#FAFAFA] hover:border-[#0052FF]/40'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${sel ? 'text-[#0052FF]' : 'text-[#AAAAAA]'}`} />
                    <span className={`text-[10px] font-semibold text-center leading-tight ${sel ? 'text-[#0052FF]' : 'text-[#888888]'}`}>
                      {label}
                    </span>
                    {sel && (
                      <div className="w-4 h-4 bg-[#0052FF] rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Upload zones */}
            {selectedDocumentType && (
              <div className="space-y-4">
                <FlatUploadZone
                  label={selectedDocumentType === 'passport' ? t('kyc.passportPhotoPage') : t('kyc.frontSide')}
                  inputId="front-upload"
                  uploaded={documents.front?.uploaded}
                  preview={previews.front}
                  progress={uploadProgress[`${selectedDocumentType}_front`]}
                  onFileChange={(f) => handleFileUpload('front', f)}
                />
                {needsBoth && (
                  <FlatUploadZone
                    label={t('kyc.backSide')}
                    inputId="back-upload"
                    uploaded={documents.back?.uploaded}
                    preview={previews.back}
                    progress={uploadProgress[`${selectedDocumentType}_back`]}
                    onFileChange={(f) => handleFileUpload('back', f)}
                  />
                )}

                {/* Guidelines */}
                <div className="mt-4 flex items-start gap-2.5 px-1">
                  <AlertCircle className="w-4 h-4 text-[#0052FF] shrink-0 mt-0.5" />
                  <div className="space-y-1 text-[12px] text-[#888888]">
                    <p className="font-semibold text-[#555555]">{t('kyc.uploadGuidelines')}</p>
                    <p>• {t('kyc.maxFileSize')}</p>
                    <p>• {t('kyc.highResolution')}</p>
                    <p>• {t('kyc.acceptedFormats')}</p>
                    {selectedDocumentType === 'passport' && <p className="text-[#0052FF]">• {t('kyc.biodataPage')}</p>}
                    {needsBoth && <p className="text-[#0052FF]">• {t('kyc.bothSidesRequired')}</p>}
                  </div>
                </div>
              </div>
            )}

            {canContinue && (
              <BottomBtn onClick={() => setActiveStep(3)} label={t('kyc.continueToReview')} />
            )}
          </div>
        )}

        {/* ════ STEP 3 ════ */}
        {activeStep === 3 && (
          <div className="flex flex-col items-center text-center pt-4 pb-4">

            {/* Status icon */}
            <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-5 ring-4 ${sm.bg} ${sm.ring}`}>
              <sm.icon className={`w-11 h-11 ${sm.color}`} />
            </div>

            <h2 className="text-[20px] font-bold text-[#111111] mb-2">{sm.title}</h2>
            <p className="text-[14px] text-[#888888] leading-relaxed max-w-[260px] mb-4">{sm.desc}</p>

            {/* Status badge */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${sm.badge}`}>
              <sm.icon className="w-3.5 h-3.5" />
              {sm.label}
            </span>

            {/* Rejection reason */}
            {kycData?.status === 'rejected' && kycData?.rejectionReason && (
              <div className="w-full mt-5 text-left bg-red-50 border border-red-100 rounded-2xl px-4 py-3.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1">Reason</p>
                <p className="text-sm text-red-600">{kycData.rejectionReason}</p>
              </div>
            )}

            {/* Actions */}
            <div className="w-full mt-6 space-y-3">
              {kycData?.status === 'documents_uploaded' && (
                <PrimaryBtn onClick={handleCompleteKyc} loading={submitLoading}
                  label="Submit for Review" loadingLabel={t('kyc.submitting')} />
              )}
              {kycData?.status === 'rejected' && (
                <PrimaryBtn onClick={() => setActiveStep(1)} label={t('kyc.resubmitApplication')} />
              )}
              <button
                onClick={() => navigate('/')}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm text-[#0052FF] bg-[#F0F5FF] hover:bg-[#E5EEFF] transition-colors"
              >
                {t('kyc.backToHome')}
              </button>
            </div>
          </div>
        )}

      </div>

      <Menu />
    </div>
  );
};

/* ── Small reusable pieces ── */

const SectionLabel = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-2 mb-4">
    <Icon className="w-4 h-4 text-[#0052FF]" />
    <span className="text-[11px] font-bold uppercase tracking-widest text-[#0052FF]">{title}</span>
  </div>
);

const Field = ({ label, error, hint, children }) => (
  <div className="mb-5">
    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#AAAAAA] mb-0.5">{label}</label>
    {children}
    {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    {!error && hint && <p className="mt-1.5 text-[11px] text-[#AAAAAA]">{hint}</p>}
  </div>
);

const BottomBtn = ({ label, loadingLabel, loading, onClick }) => (
  <div className="fixed bottom-16 left-0 right-0 px-4 z-40">
    <button
      type={onClick ? 'button' : 'submit'}
      onClick={onClick}
      disabled={loading}
      className="w-full py-4 rounded-2xl font-bold text-[15px] text-white shadow-lg shadow-[#0052FF]/25 hover:shadow-[#0052FF]/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 40%, #0052FF 100%)' }}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          {loadingLabel}
        </span>
      ) : label}
    </button>
  </div>
);

const PrimaryBtn = ({ label, loadingLabel, loading, onClick }) => (
  <button
    onClick={onClick}
    disabled={loading}
    className="w-full py-3.5 rounded-2xl font-bold text-sm text-white shadow-lg shadow-[#0052FF]/25 hover:shadow-[#0052FF]/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
    style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 40%, #0052FF 100%)' }}
  >
    {loading ? (
      <span className="flex items-center justify-center gap-2">
        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        {loadingLabel}
      </span>
    ) : label}
  </button>
);

const FlatUploadZone = ({ label, inputId, uploaded, preview, progress, onFileChange }) => {
  const isUploading = progress !== undefined && progress < 100;
  return (
    <div className={`rounded-2xl border-2 border-dashed transition-all overflow-hidden ${
      uploaded ? 'border-green-400 bg-green-50' : 'border-[#DDDDDD] bg-[#FAFAFA] hover:border-[#0052FF]/40'
    }`}>
      <div className="flex items-center gap-4 p-4">
        {/* Thumbnail or placeholder */}
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${
          uploaded ? 'bg-green-100' : 'bg-white border border-[#EEEEEE]'
        }`}>
          {preview
            ? <img src={preview} alt="preview" className="w-full h-full object-cover" />
            : uploaded
            ? <FileCheck className="w-6 h-6 text-green-500" />
            : <CreditCard className="w-6 h-6 text-[#CCCCCC]" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#111111]">{label}</p>
          {uploaded
            ? <p className="text-xs text-green-600 font-medium mt-0.5">{'\u2713'} Uploaded</p>
            : <p className="text-xs text-[#AAAAAA] mt-0.5">JPG or PNG, max 5MB</p>
          }
          {isUploading && (
            <div className="mt-2 w-full bg-[#EEEEEE] rounded-full h-1">
              <div className="bg-[#0052FF] h-1 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>

        <input type="file" accept="image/*" className="hidden" id={inputId}
          onChange={(e) => { const f = e.target.files[0]; if (f) onFileChange(f); }} />
        <label htmlFor={inputId}
          className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
            uploaded
              ? 'bg-white border border-green-300 text-green-700 hover:bg-green-50'
              : 'bg-[#0052FF] text-white hover:bg-[#0041CC]'
          }`}>
          {uploaded ? 'Change' : 'Upload'}
        </label>
      </div>
    </div>
  );
};

export default KYC;
