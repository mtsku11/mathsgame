export function mothership(size: number): string {
  return `<svg viewBox="0 0 210 210" width="${size}" height="${size}" aria-hidden="true">
<defs><radialGradient id="sp-core-fill" cx="50%" cy="42%" r="60%"><stop offset="0" stop-color="#FFFBE0"/><stop offset=".45" stop-color="#FFD23F"/><stop offset="1" stop-color="#FF8A1E"/></radialGradient>
<radialGradient id="sp-core-halo" cx="50%" cy="50%" r="50%"><stop offset=".5" stop-color="#FFD23F" stop-opacity=".55"/><stop offset="1" stop-color="#FFD23F" stop-opacity="0"/></radialGradient></defs>
<circle class="sp-halo" cx="105" cy="105" r="104" fill="url(#sp-core-halo)"/>
<path d="M9 108 A96 30 0 0 1 201 108" stroke="#5B4BD6" stroke-width="12" fill="none" stroke-linecap="round"/>
<circle cx="105" cy="105" r="64" fill="#2B1E86" stroke="#9D90FF" stroke-width="5"/>
<circle cx="105" cy="105" r="52" fill="url(#sp-core-fill)"/>
<ellipse cx="88" cy="80" rx="18" ry="10" fill="#fff" opacity=".55" transform="rotate(-25 88 80)"/>
<text class="sp-core-num" x="105" y="126" text-anchor="middle" font-size="56" fill="#5A2A00">0</text>
<path d="M9 108 A96 30 0 0 0 201 108" stroke="#B3A8FF" stroke-width="12" fill="none" stroke-linecap="round"/>
<circle cx="30" cy="121" r="4" fill="#FFD23F"/><circle cx="62" cy="133" r="4" fill="#FF5DA2"/><circle cx="105" cy="138" r="4" fill="#36D6FF"/><circle cx="148" cy="133" r="4" fill="#FF9F43"/><circle cx="180" cy="121" r="4" fill="#9DF26B"/>
</svg>`;
}
