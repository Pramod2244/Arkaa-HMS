"use client";
import React, { forwardRef, useId } from "react";

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: React.ReactNode;
  error?: string;
  rightElement?: React.ReactNode;
}

const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, icon, error, rightElement, id: externalId, ...inputProps }, ref) => {
    const generatedId = useId();
    const id = externalId ?? generatedId;
    const errorId = `${id}-error`;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label
          htmlFor={id}
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "#8A7060",
            letterSpacing: "0.02em",
          }}
        >
          {label}
        </label>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          {icon && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 11,
                display: "flex",
                alignItems: "center",
                color: "#C0A890",
                pointerEvents: "none",
                zIndex: 1,
              }}
            >
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            aria-label={label}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            {...inputProps}
            style={{
              width: "100%",
              height: 40,
              background: "#FFFAF6",
              border: `0.5px solid ${error ? "#E24B4A" : "#E8D8C8"}`,
              borderRadius: 8,
              paddingLeft: icon ? 36 : 12,
              paddingRight: rightElement ? 40 : 12,
              fontSize: 13,
              color: "#1A1208",
              outline: "none",
              transition: "border-color 0.15s, box-shadow 0.15s",
              ...inputProps.style,
            }}
            onFocus={(e) => {
              e.target.style.boxShadow = "0 0 0 3px rgba(232,100,10,0.10)";
              e.target.style.borderColor = "#E8640A";
              inputProps.onFocus?.(e);
            }}
            onBlur={(e) => {
              e.target.style.boxShadow = "none";
              e.target.style.borderColor = error ? "#E24B4A" : "#E8D8C8";
              inputProps.onBlur?.(e);
            }}
          />
          {rightElement && (
            <span
              style={{
                position: "absolute",
                right: 10,
                display: "flex",
                alignItems: "center",
              }}
            >
              {rightElement}
            </span>
          )}
        </div>
        {error && (
          <span
            id={errorId}
            role="alert"
            style={{ fontSize: 11, color: "#E24B4A", marginTop: 2 }}
          >
            {error}
          </span>
        )}
      </div>
    );
  }
);

FormInput.displayName = "FormInput";
export default FormInput;
