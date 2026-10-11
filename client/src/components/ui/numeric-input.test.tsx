import {render,screen,fireEvent} from "@testing-library/react";
import {useState} from "react";
import {it,expect} from "vitest";
import {NumericInput} from "./numeric-input";
it("keeps a deleted number blank through blur and refocus despite numeric parent coercion",()=>{
 function Form(){const [value,set]=useState(10);return <NumericInput aria-label="Amount" value={value} onChange={e=>set(Number(e.target.value))}/>;}
 render(<Form/>);const input=screen.getByRole("spinbutton") as HTMLInputElement;
 fireEvent.focus(input);fireEvent.change(input,{target:{value:""}});expect(input.value).toBe("");
 fireEvent.blur(input);expect(input.value).toBe("");fireEvent.focus(input);expect(input.value).toBe("");
 fireEvent.change(input,{target:{value:"12.5"}});expect(input.value).toBe("12.5");
});
