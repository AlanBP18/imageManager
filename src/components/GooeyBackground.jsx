import React from 'react'

export default function GooeyBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-[#0f172a]">
      {/* 
        Efecto viscoso (gooey) de lámpara de lava.
        Lo renderizamos en blanco y negro para asegurar una fusión perfecta entre las burbujas 
        sin que los colores se mezclen mal. mix-blend-screen hace que el fondo negro sea 
        completamente transparente sobre el fondo slate-900 del sitio.
      */}
      <div className="gooey-wrapper mix-blend-screen">
        
        {/* Límite superior de la lámpara de lava */}
        <div className="absolute top-[100px] left-0 right-0 h-[114px] bg-white" />

        {/* Límite inferior de la lámpara de lava */}
        <div className="absolute bottom-[100px] left-0 right-0 h-[114px] bg-white" />

        {/* Burbujas flotantes blancas (L / XL) */}
        <div className="gooey-blob w-[280px] h-[280px] bg-white left-[15%] animate-lava-xl1" />
        <div className="gooey-blob w-[250px] h-[250px] bg-white left-[68%] animate-lava-xl2" />
        <div className="gooey-blob w-[220px] h-[220px] bg-white left-[42%] animate-lava-l1" />
        <div className="gooey-blob w-[200px] h-[200px] bg-white left-[80%] animate-lava-l2" />

        {/* Burbujas medianas */}
        <div className="gooey-blob w-[180px] h-[180px] bg-white left-[2%] animate-lava-m1" />
        <div className="gooey-blob w-[160px] h-[160px] bg-white left-[55%] animate-lava-m2" />
        <div className="gooey-blob w-[150px] h-[150px] bg-white left-[28%] animate-lava-m3" />

        {/* Burbujas pequeñas */}
        <div className="gooey-blob w-[130px] h-[130px] bg-white left-[90%] animate-lava-s1" />
        <div className="gooey-blob w-[110px] h-[110px] bg-white left-[35%] animate-lava-s2" />
        <div className="gooey-blob w-[95px] h-[95px] bg-white left-[60%] animate-lava-s3" />

        {/* Burbujas diminutas */}
        <div className="gooey-blob w-[80px] h-[80px] bg-white left-[18%] animate-lava-t1" />
        <div className="gooey-blob w-[70px] h-[70px] bg-white left-[48%] animate-lava-t2" />
        <div className="gooey-blob w-[60px] h-[60px] bg-white left-[75%] animate-lava-t3" />
        <div className="gooey-blob w-[50px] h-[50px] bg-white left-[5%] animate-lava-t4" />

        {/* Capa de tinte que multiplica el color índigo sobre los blobs blancos */}
        <div className="absolute inset-0 bg-[#7c89f8] mix-blend-multiply pointer-events-none" />
      </div>

      {/* Cuadrícula decorativa semitransparente */}
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-25" />
    </div>
  )
}
