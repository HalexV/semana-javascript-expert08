import Clock from "./deps/clock.js";
import View from "./view.js";

const view = new View();
const clock = new Clock();

const worker = new Worker("./src/worker/worker.js", {
  type: "module",
});

worker.onerror = (error) => console.error("erro worker", error);
worker.onmessage = ({ data }) => {
  if (data.status !== "done") return;
  clock.stop();
  view.updateElapsedTime(`Process took ${took.replace("ago", "")}`);
  if (!data.buffer) return;
  view.downloadBlobAsFile(data.buffer, data.filename);
};

let took = "";

// Pega o canvas e o file escolhido no upload para enviar para o worker.
view.configureOnFileChange((file) => {
  const canvas = view.getCanvas();
  worker.postMessage(
    {
      file,
      canvas,
    },
    // Transfere a função do processo principal para o sub-processo.
    // Só funciona para alguns elementos.
    [canvas]
  );

  clock.start((time) => {
    took = time;
    view.updateElapsedTime(`Process started ${time}`);
  });
});

// Serve para não ter que ficar clicando no botão de upload e escolher o arquivo nessa etapa de desenvolvimento. Caso contrário toda vez teria que clicar lá e ficar escolhendo o arquivo.
// async function fakeFetch() {
//   const filePath = "/videos/frag_bunny.mp4";
//   const response = await fetch(filePath);

//   // traz o tamanho do arquivo
//   //   const response = await fetch(filePath, {
//   //     method: "HEAD",
//   //   });
//   // response.headers.get('content-length')
//   // debugger

//   const file = new File([await response.blob()], filePath, {
//     type: "video/mp4",
//     lastModified: Date.now(),
//   });

//   const event = new Event("change");
//   Reflect.defineProperty(event, "target", {
//     value: {
//       files: [file],
//     },
//   });

//   document.getElementById("fileUpload").dispatchEvent(event);
// }

// fakeFetch();
