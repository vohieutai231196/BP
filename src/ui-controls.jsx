/* ============================================================
   GomĐơn — Controls dùng chung: Select + DateField
   Thay native <select> / <input type=date> để khớp theme.
   Giá trị emit GIỮ NGUYÊN kiểu cũ (string) → call-site đổi tối thiểu.
   ============================================================ */
import React from "react";
import * as RSelect from "@radix-ui/react-select";
import { Icon } from "./icons.jsx";
import * as RPopover from "@radix-ui/react-popover";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

/* Select: thay <select className="sel">.
   props:
     value     : string ("" = chưa chọn → hiện placeholder)
     onChange  : (value:string) => void   // emit string trực tiếp, KHÔNG phải event
     options   : Array<{ value, label, disabled? }>
     icon      : tên icon trái (vd "filter") — optional
     placeholder, disabled, className, style, ariaLabel */
export function Select({ value, onChange, options, icon, placeholder = "— Chọn —", disabled, className, style, ariaLabel }) {
  return (
    <RSelect.Root value={value == null ? "" : String(value)} onValueChange={onChange} disabled={disabled}>
      <RSelect.Trigger className={"input sel-trigger" + (className ? " " + className : "")} style={style} aria-label={ariaLabel}>
        {icon && <Icon name={icon} size={16} />}
        <span className="sel-value"><RSelect.Value placeholder={placeholder} /></span>
        <RSelect.Icon className="sel-chevron"><Icon name="chevDown" size={16} /></RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content className="sel-content" position="popper" sideOffset={6}>
          <RSelect.Viewport className="sel-viewport">
            {options.map((o) => (
              <RSelect.Item key={String(o.value)} value={String(o.value)} disabled={o.disabled} className="sel-item">
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
                <RSelect.ItemIndicator className="sel-tick"><Icon name="check" size={15} /></RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}

/* yyyy-MM-dd <-> Date (local, tránh lệch timezone do new Date("yyyy-mm-dd") = UTC) */
const parseYMD = (s) => {
  if (!s) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};
const toYMD = (d) => {
  if (!d) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const fmtVN = (d) => (d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` : "");

/* DateField: thay <input type="date">.
   value/onChange dùng chuỗi "yyyy-MM-dd" ("" = rỗng) — GIỮ NGUYÊN format lưu. */
export function DateField({ value, onChange, icon = "calendar", placeholder = "Chọn ngày", disabled }) {
  const [open, setOpen] = React.useState(false);
  const selected = parseYMD(value);
  const pick = (d) => { onChange(toYMD(d)); setOpen(false); };
  return (
    <RPopover.Root open={open} onOpenChange={setOpen}>
      <RPopover.Trigger asChild>
        <button type="button" className="input date-trigger" disabled={disabled}>
          <Icon name={icon} size={16} />
          <span className={"date-value" + (selected ? "" : " empty")}>{selected ? fmtVN(selected) : placeholder}</span>
        </button>
      </RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content className="date-pop" sideOffset={6} align="start">
          <DayPicker
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={pick}
            showOutsideDays
            weekStartsOn={1}
            footer={
              <div className="date-foot">
                <button type="button" className="date-foot-btn" onClick={() => pick(new Date())}>Hôm nay</button>
                <button type="button" className="date-foot-btn clear" onClick={() => { onChange(""); setOpen(false); }}>Xóa</button>
              </div>
            }
          />
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}
