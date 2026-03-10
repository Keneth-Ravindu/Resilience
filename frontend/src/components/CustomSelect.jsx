import { useEffect, useRef, useState } from "react";

export default function CustomSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Select...",
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const selected = options.find((opt) => opt.value === value);

  return (
    <div className="custom-select-block" ref={wrapRef}>
      {label ? <label className="filter-label">{label}</label> : null}

      <button
        type="button"
        className={`custom-select-trigger ${open ? "open" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{selected?.label || placeholder}</span>
        <span className={`custom-select-arrow ${open ? "rotate" : ""}`}>⌄</span>
      </button>

      {open ? (
        <div className="custom-select-menu">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`custom-select-option ${
                value === opt.value ? "selected" : ""
              }`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}