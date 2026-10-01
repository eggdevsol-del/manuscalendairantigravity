// @vitest-environment jsdom
import { useState } from "react";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { NumericInput } from "./numeric-input";
afterEach(cleanup);
it("allows zero to be cleared and replaced despite numeric parent coercion", () => {
  function Field() { const [value,setValue] = useState(0); return <NumericInput aria-label="Amount" value={value} onChange={e=>setValue(Number(e.target.value))} />; }
  render(<Field />);
  const field = screen.getByRole('spinbutton') as HTMLInputElement;
  fireEvent.focus(field); fireEvent.change(field,{target:{value:''}});
  expect(field.value).toBe('');
  fireEvent.change(field,{target:{value:'25.50'}});
  expect(field.value).toBe('25.50');
  fireEvent.blur(field); expect(field.valueAsNumber).toBe(25.5);
});
it("retains required validation while empty", () => {
  render(<NumericInput required value={0} onChange={()=>{}} />);
  const field = screen.getByRole('spinbutton') as HTMLInputElement;
  fireEvent.focus(field); fireEvent.change(field,{target:{value:''}});
  expect(field.validity.valueMissing).toBe(true);
});
