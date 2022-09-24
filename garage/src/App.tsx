import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { Enter } from "./pages/Enter";

function App() {
  return (
    <ChakraProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Enter />} />
        </Routes>
      </BrowserRouter>
    </ChakraProvider>
  );
}

export default App;
