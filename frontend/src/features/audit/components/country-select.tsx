'use client';

import { useState, useRef, useEffect } from 'react';

function FlagImg({ code, size = 20 }: { code: string; size?: number }) {
  // Convert country code to regional indicator Unicode codepoints for Twemoji
  const codePoints = code
    .toUpperCase()
    .split('')
    .map((c) => (0x1f1e6 + c.charCodeAt(0) - 65).toString(16))
    .join('-');
  return (
    <img
      src={`https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/${codePoints}.svg`}
      width={size}
      height={Math.round(size * 0.75)}
      alt=""
      className="inline-block shrink-0"
      loading="lazy"
    />
  );
}

interface CountryOption {
  code: string;
  label: string;
}

const COUNTRIES: CountryOption[] = [
  { code: 'af', label: 'Afghanistan' },
  { code: 'al', label: 'Albania' },
  { code: 'dz', label: 'Algeria' },
  { code: 'ad', label: 'Andorra' },
  { code: 'ao', label: 'Angola' },
  { code: 'ag', label: 'Antigua and Barbuda' },
  { code: 'ar', label: 'Argentina' },
  { code: 'am', label: 'Armenia' },
  { code: 'au', label: 'Australia' },
  { code: 'at', label: 'Austria' },
  { code: 'az', label: 'Azerbaijan' },
  { code: 'bs', label: 'Bahamas' },
  { code: 'bh', label: 'Bahrain' },
  { code: 'bd', label: 'Bangladesh' },
  { code: 'bb', label: 'Barbados' },
  { code: 'by', label: 'Belarus' },
  { code: 'be', label: 'Belgium' },
  { code: 'bz', label: 'Belize' },
  { code: 'bj', label: 'Benin' },
  { code: 'bt', label: 'Bhutan' },
  { code: 'bo', label: 'Bolivia' },
  { code: 'ba', label: 'Bosnia and Herzegovina' },
  { code: 'bw', label: 'Botswana' },
  { code: 'br', label: 'Brazil' },
  { code: 'bn', label: 'Brunei' },
  { code: 'bg', label: 'Bulgaria' },
  { code: 'bf', label: 'Burkina Faso' },
  { code: 'bi', label: 'Burundi' },
  { code: 'kh', label: 'Cambodia' },
  { code: 'cm', label: 'Cameroon' },
  { code: 'ca', label: 'Canada' },
  { code: 'cv', label: 'Cape Verde' },
  { code: 'cf', label: 'Central African Republic' },
  { code: 'td', label: 'Chad' },
  { code: 'cl', label: 'Chile' },
  { code: 'cn', label: 'China' },
  { code: 'co', label: 'Colombia' },
  { code: 'km', label: 'Comoros' },
  { code: 'cg', label: 'Congo' },
  { code: 'cr', label: 'Costa Rica' },
  { code: 'hr', label: 'Croatia' },
  { code: 'cu', label: 'Cuba' },
  { code: 'cy', label: 'Cyprus' },
  { code: 'cz', label: 'Czech Republic' },
  { code: 'dk', label: 'Denmark' },
  { code: 'dj', label: 'Djibouti' },
  { code: 'dm', label: 'Dominica' },
  { code: 'do', label: 'Dominican Republic' },
  { code: 'ec', label: 'Ecuador' },
  { code: 'eg', label: 'Egypt' },
  { code: 'sv', label: 'El Salvador' },
  { code: 'gq', label: 'Equatorial Guinea' },
  { code: 'er', label: 'Eritrea' },
  { code: 'ee', label: 'Estonia' },
  { code: 'sz', label: 'Eswatini' },
  { code: 'et', label: 'Ethiopia' },
  { code: 'fj', label: 'Fiji' },
  { code: 'fi', label: 'Finland' },
  { code: 'fr', label: 'France' },
  { code: 'ga', label: 'Gabon' },
  { code: 'gm', label: 'Gambia' },
  { code: 'ge', label: 'Georgia' },
  { code: 'de', label: 'Germany' },
  { code: 'gh', label: 'Ghana' },
  { code: 'gr', label: 'Greece' },
  { code: 'gd', label: 'Grenada' },
  { code: 'gt', label: 'Guatemala' },
  { code: 'gn', label: 'Guinea' },
  { code: 'gw', label: 'Guinea-Bissau' },
  { code: 'gy', label: 'Guyana' },
  { code: 'ht', label: 'Haiti' },
  { code: 'hn', label: 'Honduras' },
  { code: 'hk', label: 'Hong Kong' },
  { code: 'hu', label: 'Hungary' },
  { code: 'is', label: 'Iceland' },
  { code: 'in', label: 'India' },
  { code: 'id', label: 'Indonesia' },
  { code: 'ir', label: 'Iran' },
  { code: 'iq', label: 'Iraq' },
  { code: 'ie', label: 'Ireland' },
  { code: 'il', label: 'Israel' },
  { code: 'it', label: 'Italy' },
  { code: 'ci', label: 'Ivory Coast' },
  { code: 'jm', label: 'Jamaica' },
  { code: 'jp', label: 'Japan' },
  { code: 'jo', label: 'Jordan' },
  { code: 'kz', label: 'Kazakhstan' },
  { code: 'ke', label: 'Kenya' },
  { code: 'ki', label: 'Kiribati' },
  { code: 'kw', label: 'Kuwait' },
  { code: 'kg', label: 'Kyrgyzstan' },
  { code: 'la', label: 'Laos' },
  { code: 'lv', label: 'Latvia' },
  { code: 'lb', label: 'Lebanon' },
  { code: 'ls', label: 'Lesotho' },
  { code: 'lr', label: 'Liberia' },
  { code: 'ly', label: 'Libya' },
  { code: 'li', label: 'Liechtenstein' },
  { code: 'lt', label: 'Lithuania' },
  { code: 'lu', label: 'Luxembourg' },
  { code: 'mo', label: 'Macau' },
  { code: 'mg', label: 'Madagascar' },
  { code: 'mw', label: 'Malawi' },
  { code: 'my', label: 'Malaysia' },
  { code: 'mv', label: 'Maldives' },
  { code: 'ml', label: 'Mali' },
  { code: 'mt', label: 'Malta' },
  { code: 'mh', label: 'Marshall Islands' },
  { code: 'mr', label: 'Mauritania' },
  { code: 'mu', label: 'Mauritius' },
  { code: 'mx', label: 'Mexico' },
  { code: 'fm', label: 'Micronesia' },
  { code: 'md', label: 'Moldova' },
  { code: 'mc', label: 'Monaco' },
  { code: 'mn', label: 'Mongolia' },
  { code: 'me', label: 'Montenegro' },
  { code: 'ma', label: 'Morocco' },
  { code: 'mz', label: 'Mozambique' },
  { code: 'mm', label: 'Myanmar' },
  { code: 'na', label: 'Namibia' },
  { code: 'nr', label: 'Nauru' },
  { code: 'np', label: 'Nepal' },
  { code: 'nl', label: 'Netherlands' },
  { code: 'nz', label: 'New Zealand' },
  { code: 'ni', label: 'Nicaragua' },
  { code: 'ne', label: 'Niger' },
  { code: 'ng', label: 'Nigeria' },
  { code: 'kp', label: 'North Korea' },
  { code: 'mk', label: 'North Macedonia' },
  { code: 'no', label: 'Norway' },
  { code: 'om', label: 'Oman' },
  { code: 'pk', label: 'Pakistan' },
  { code: 'pw', label: 'Palau' },
  { code: 'ps', label: 'Palestine' },
  { code: 'pa', label: 'Panama' },
  { code: 'pg', label: 'Papua New Guinea' },
  { code: 'py', label: 'Paraguay' },
  { code: 'pe', label: 'Peru' },
  { code: 'ph', label: 'Philippines' },
  { code: 'pl', label: 'Poland' },
  { code: 'pt', label: 'Portugal' },
  { code: 'qa', label: 'Qatar' },
  { code: 'ro', label: 'Romania' },
  { code: 'ru', label: 'Russia' },
  { code: 'rw', label: 'Rwanda' },
  { code: 'kn', label: 'Saint Kitts and Nevis' },
  { code: 'lc', label: 'Saint Lucia' },
  { code: 'vc', label: 'Saint Vincent and the Grenadines' },
  { code: 'ws', label: 'Samoa' },
  { code: 'sm', label: 'San Marino' },
  { code: 'st', label: 'Sao Tome and Principe' },
  { code: 'sa', label: 'Saudi Arabia' },
  { code: 'sn', label: 'Senegal' },
  { code: 'rs', label: 'Serbia' },
  { code: 'sc', label: 'Seychelles' },
  { code: 'sl', label: 'Sierra Leone' },
  { code: 'sg', label: 'Singapore' },
  { code: 'sk', label: 'Slovakia' },
  { code: 'si', label: 'Slovenia' },
  { code: 'sb', label: 'Solomon Islands' },
  { code: 'so', label: 'Somalia' },
  { code: 'za', label: 'South Africa' },
  { code: 'kr', label: 'South Korea' },
  { code: 'ss', label: 'South Sudan' },
  { code: 'es', label: 'Spain' },
  { code: 'lk', label: 'Sri Lanka' },
  { code: 'sd', label: 'Sudan' },
  { code: 'sr', label: 'Suriname' },
  { code: 'se', label: 'Sweden' },
  { code: 'ch', label: 'Switzerland' },
  { code: 'sy', label: 'Syria' },
  { code: 'tw', label: 'Taiwan' },
  { code: 'tj', label: 'Tajikistan' },
  { code: 'tz', label: 'Tanzania' },
  { code: 'th', label: 'Thailand' },
  { code: 'tl', label: 'Timor-Leste' },
  { code: 'tg', label: 'Togo' },
  { code: 'to', label: 'Tonga' },
  { code: 'tt', label: 'Trinidad and Tobago' },
  { code: 'tn', label: 'Tunisia' },
  { code: 'tr', label: 'Turkey' },
  { code: 'tm', label: 'Turkmenistan' },
  { code: 'tv', label: 'Tuvalu' },
  { code: 'ug', label: 'Uganda' },
  { code: 'ua', label: 'Ukraine' },
  { code: 'ae', label: 'United Arab Emirates' },
  { code: 'gb', label: 'United Kingdom' },
  { code: 'us', label: 'United States' },
  { code: 'uy', label: 'Uruguay' },
  { code: 'uz', label: 'Uzbekistan' },
  { code: 'vu', label: 'Vanuatu' },
  { code: 'va', label: 'Vatican City' },
  { code: 've', label: 'Venezuela' },
  { code: 'vn', label: 'Vietnam' },
  { code: 'ye', label: 'Yemen' },
  { code: 'zm', label: 'Zambia' },
  { code: 'zw', label: 'Zimbabwe' },
];

const COUNTRY_MAP = new Map(COUNTRIES.map((c) => [c.code, c]));

interface Props {
  selected: string[];
  onChange: (codes: string[]) => void;
}

export function CountrySelect({ selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = search
    ? COUNTRIES.filter((c) => c.label.toLowerCase().includes(search.toLowerCase()))
    : COUNTRIES;

  function toggle(code: string) {
    onChange(
      selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code],
    );
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(!open); if (!open) setTimeout(() => inputRef.current?.focus(), 0); }}
        className="flex h-11 w-full items-center justify-between rounded-[10px] border border-[#D7DCE5] bg-white px-3 text-sm text-[#111827] transition-colors hover:border-[#9CA3AF] focus:border-[#DA304F] focus:outline-none focus:ring-1 focus:ring-[#DA304F]"
      >
        <span className="flex items-center gap-1.5 truncate">
          {selected.length === 0
            ? <span className="text-[#9CA3AF]">Select countries...</span>
            : selected.length <= 3
              ? selected.map((code, i) => {
                  const c = COUNTRY_MAP.get(code);
                  if (!c) return code;
                  return <span key={code} className="inline-flex items-center gap-1">{i > 0 && ', '}<FlagImg code={code} size={16} /> {c.label}</span>;
                })
              : <span>{selected.length} countries selected</span>}
        </span>
        <svg className={`ml-2 h-4 w-4 shrink-0 text-[#9CA3AF] transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Selected pills */}
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((code) => {
            const c = COUNTRY_MAP.get(code);
            if (!c) return null;
            return (
              <span
                key={code}
                className="inline-flex items-center gap-1.5 rounded-pill border border-[#DA304F] bg-[#FCF4F6] px-2 py-0.5 text-xs font-medium text-[#DA304F]"
              >
                <FlagImg code={code} size={14} /> {c.label}
                <button
                  type="button"
                  onClick={() => toggle(code)}
                  className="ml-0.5 text-[#DA304F] hover:text-[#AE213E]"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-[10px] border border-[#E8EAF0] bg-white shadow-lg">
          <div className="border-b border-[#E8EAF0] p-2">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search countries..."
              className="h-8 w-full rounded-lg border border-[#D7DCE5] bg-[#F8F9FC] px-2.5 text-xs text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#DA304F] focus:outline-none"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-[#9CA3AF]">No countries found</li>
            )}
            {filtered.map((c) => {
              const active = selected.includes(c.code);
              return (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => toggle(c.code)}
                    className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors hover:bg-[#F8F9FC] ${
                      active ? 'bg-[#FCF4F6] text-[#DA304F]' : 'text-[#111827]'
                    }`}
                  >
                    <FlagImg code={c.code} />
                    <span className="flex-1">{c.label}</span>
                    {active && (
                      <svg className="h-4 w-4 text-[#DA304F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
