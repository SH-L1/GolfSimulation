if(NOT TARGET react-native-reanimated::reanimated)
add_library(react-native-reanimated::reanimated SHARED IMPORTED)
set_target_properties(react-native-reanimated::reanimated PROPERTIES
    IMPORTED_LOCATION "C:/project/golf_frontend/node_modules/react-native-reanimated/android/build/intermediates/cxx/Debug/r4vh1u2m/obj/x86/libreanimated.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/project/golf_frontend/node_modules/react-native-reanimated/android/build/prefab-headers/reanimated"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

