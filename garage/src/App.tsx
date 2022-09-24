import React from "react";
import { ChakraProvider } from "@chakra-ui/react";
import { Box } from "@chakra-ui/react";

function App() {
  return (
    <ChakraProvider>
      <Box>Garage</Box>
    </ChakraProvider>
  );
}

export default App;
