import { useEffect } from "react";
import { pendingCount, selectedPhoto } from "../core/editor";
import { EditorCanvas } from "./EditorCanvas";
import { Filmstrip } from "./Filmstrip";
import { LoadingOverlay } from "./LoadingOverlay";
import { NavBar } from "./NavBar";
import { Toolbar } from "./Toolbar";
import { UpdateBanner } from "./UpdateBanner";
import { useAppUpdate } from "./useAppUpdate";
import { useEditor } from "./useEditor";

function App() {
  const state = useEditor();
  const { photos, settings, phase, selectedIndex } = state;
  const photo = selectedPhoto(state);
  const { needRefresh, update } = useAppUpdate();

  // with nothing open there is no work to lose, so switch to a new version
  // straight away; otherwise offer it and let the user choose when
  const updateNow = needRefresh && phase === "start";
  useEffect(() => {
    if (updateNow) update();
  }, [updateNow, update]);

  return (
    <>
      <NavBar hasPhotos={photos.length > 0} photo={photo} settings={settings} />
      <div className="canvas-wrap">
        <EditorCanvas photo={photo} settings={settings} />
        {photos.length > 0 ? (
          <Toolbar photo={photo} settings={settings} />
        ) : null}
      </div>
      <Filmstrip
        photos={photos}
        selectedIndex={selectedIndex}
        pendingCount={pendingCount(state)}
        bg={settings.bg}
      />
      {phase === "loading" ? <LoadingOverlay /> : null}
      {needRefresh && phase !== "start" ? (
        <UpdateBanner onUpdate={update} />
      ) : null}
    </>
  );
}

export default App;
