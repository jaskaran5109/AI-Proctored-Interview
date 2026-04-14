import { useState, useRef, useEffect } from "react";

export default function CustomDropdown({
  options = [],
  value,
  onChange,
  placeholder = "Select option",
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef();

  const selected = options.find((opt) => opt.value === value);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full rounded-2xl border dark:border-gray-200 border-gray-300 dark:border-white/10 dark:bg-white/5 px-4 py-3 text-left flex justify-between items-center"
      >
        <span className="truncate mr-2">
          {selected?.label || placeholder}
        </span>
        <span className="text-sm">▼</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-20 mt-2 w-full max-h-[15vh] rounded-2xl border border-gray-300 dark:border-white/10 bg-white dark:bg-gray-900 shadow-lg overflow-auto">
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`px-4 py-3 cursor-pointer transition ${
                value === opt.value
                  ? "bg-gray-200 dark:bg-gray-700"
                  : "bg-white dark:bg-gray-800"
              } hover:bg-gray-200 dark:hover:bg-gray-600`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}