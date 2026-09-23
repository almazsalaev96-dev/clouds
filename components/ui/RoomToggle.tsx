"use client";
import * as React from "react";

/**
 * The sidebar button, handed to whichever room is showing.
 *
 * On a phone with the sidebar closed the button needs somewhere to live, and
 * it used to get a row of its own above every room — a bar with one button
 * in the corner, then the room's own title and "New page" a row below it:
 * a hundred pixels of a four-inch screen spent on a stack of two headers.
 * A room's own header puts it in its first row instead, wrapped in
 * `.has-room-toggle`, and `main:has(.has-room-toggle)` in globals.css hides
 * the lone row whenever one does.
 */
export const RoomToggle = React.createContext<React.ReactNode>(null);
